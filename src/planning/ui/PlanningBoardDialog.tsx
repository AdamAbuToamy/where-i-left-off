import BoardRelationshipsProvider from "../../productivity/Provider";
import { useBoardRelationships } from "../../productivity/context";
import { cardKey } from "../../productivity/state";

import { createPortal } from "react-dom";
import { PlanningActions } from "./actions";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useMemo,
  useCallback,
} from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  useReactFlow,
  useNodesInitialized,
  ConnectionMode,
} from "@xyflow/react";
import type { Connection } from "@xyflow/react";
import {
  Check,
  Frame,
  Focus,
  LocateFixed,
  CircleHelp,
  Download,
  Hand,
  LoaderCircle,
  Maximize2,
  Network,
  Pencil,
  Plus,
  Redo2,
  Search,
  StickyNote,
  Trash2,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { Project, Section } from "../../types";
import type { Language } from "../../translations";
import { createClientId } from "../../lib/clientId";
import {
  boardNavigationCache,
  createPlanningRepository,
} from "../browserRepository";
import type { BoardView, PlanningRepository } from "../repository";
import {
  addBoardCard,
  addBoardNote,
  connectBoardItems,
  editBoardNote,
  moveBoardItem,
  recognizeCircle,
  removeBoardCircle,
  removeBoardItem,
  removeBoardThread,
  parsePlanningState,
  editBoardThread,
  addBoardZone,
  editBoardZone,
  convertBoardNote,
  boardNeighborhood,
  boardBlockers,
  boardBounds,
} from "../domain";
import type { PlanningState, Point, ThreadKind } from "../domain";
import {
  PlanningCardNode,
  PlanningNoteNode,
  PlanningZoneNode,
  RopeEdge,
  RopeConnection,
} from "./Nodes";
import type { PlanningNode, PlanningEdge } from "./Nodes";
import CircleLayer from "./CircleLayer";
import { boardWords } from "./detailsText";
import { planningWords } from "./text";
import "@xyflow/react/dist/style.css";
import "./planning.css";

type Props = {
  uid: string;
  scope: string;
  projects: Project[];
  sections: Section[];
  language: Language;
  onClose: () => void;
  onOpenCard: (id: string) => void;
  onConvertNote?: (noteId: string, text: string) => Promise<string | null>;
};
const nodeTypes = {
  card: PlanningCardNode,
  note: PlanningNoteNode,
  zone: PlanningZoneNode,
};
const edgeTypes = { rope: RopeEdge };
export default function PlanningBoardDialog(props: Props) {
  const dialog = useRef<HTMLDialogElement>(null),
    title = useId();
  const [repository] = useState(() =>
    createPlanningRepository(props.uid, props.scope),
  );
  const [view, setView] = useState<BoardView>(() => repository.view);
  useLayoutEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
    return () => {
      element?.close();
    };
  }, []);
  useEffect(() => {
    const stop = repository.start(setView),
      online = () => repository.retry();
    window.addEventListener("online", online);
    return () => {
      window.removeEventListener("online", online);
      stop();
    };
  }, [repository]);
  const inspectionCleanup = useRef<() => void>(() => {});
  useEffect(() => () => inspectionCleanup.current(), []);
  const openMainCard = props.onOpenCard;
  const inspect = useCallback(
    (id: string) => {
      inspectionCleanup.current();
      const element = dialog.current;
      if (!element) return;
      element.close();
      let started = false;
      const restore = () => {
        observer.disconnect();
        clearTimeout(timer);
        if (element.isConnected && !element.open) element.showModal();
      };
      const observer = new MutationObserver(() => {
        if (document.documentElement.hasAttribute("data-card-surface"))
          started = true;
        else if (started) restore();
      });
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-card-surface"],
      });
      const timer = setTimeout(() => {
        if (!started) restore();
      }, 4000);
      inspectionCleanup.current = () => {
        observer.disconnect();
        clearTimeout(timer);
      };
      openMainCard(id);
    },
    [openMainCard],
  );
  return createPortal(
    <dialog
      ref={dialog}
      className="planning-board-dialog"
      aria-labelledby={title}
      onCancel={(event) => {
        event.preventDefault();
        props.onClose();
      }}
    >
      <BoardRelationshipsProvider uid={props.uid}>
        <ReactFlowProvider>
          <PlanningCanvas
            {...props}
            onOpenCard={inspect}
            titleId={title}
            repository={repository}
            view={view}
          />
        </ReactFlowProvider>
      </BoardRelationshipsProvider>
    </dialog>,
    document.body,
  );
}
function PlanningCanvas({
  repository,
  view,
  titleId,
  ...props
}: Props & {
  repository: PlanningRepository;
  view: BoardView;
  titleId: string;
}) {
  const experience = useBoardRelationships();
  const w = boardWords(props.language);
  const t = planningWords[props.language],
    container = useRef<HTMLDivElement>(null),
    dragging = useRef<string | null>(null),
    fitted = useRef(false);
  const [nodes, setNodes, onNodesChange] = useNodesState<PlanningNode>([]),
    [edges, setEdges, onEdgesChange] = useEdgesState<PlanningEdge>([]);
  const flow = useReactFlow<PlanningNode, PlanningEdge>(),
    initialized = useNodesInitialized();
  const navigation = useMemo(
    () => boardNavigationCache(props.uid, props.scope),
    [props.uid, props.scope],
  );
  const [initialNavigation] = useState(() => navigation.read());
  const [selectedItem, setSelectedItem] = useState(
    initialNavigation?.selected || "",
  );
  const [focusMode, setFocusMode] = useState(false);
  const [focusedThread, setFocusedThread] = useState("");
  const [converting, setConverting] = useState("");
  const [mode, setMode] = useState<"move" | "pen" | "thread">("move"),
    [picker, setPicker] = useState(false),
    [query, setQuery] = useState(""),
    [selectedCircle, setSelectedCircle] = useState(""),
    [message, setMessage] = useState("");
  const change = useCallback(
    (update: (state: PlanningState) => PlanningState, historyGroup = "") => {
      try {
        if (
          repository.view.conflict ||
          repository.view.error === "invalid-local"
        )
          throw new Error("planning-conflict");
        repository.apply(update(repository.state), historyGroup);
        setMessage("");
        return true;
      } catch (error) {
        const code = (error as { code?: string }).code;
        setMessage(
          code === "planning-cycle"
            ? w.cycle
            : code === "planning-circle"
              ? t.invalidCircle
              : code === "planning-full"
                ? t.full
                : code === "planning-local"
                  ? t.localError
                  : t.invalid,
        );
        return false;
      }
    },
    [repository, t, w.cycle],
  );
  const { onOpenCard, onConvertNote, projects } = props;
  const actions = useMemo(
    () => ({
      editNote: (id: string, text: string) =>
        change((state) => editBoardNote(state, id, text), "note:" + id),
      remove: (id: string) => change((state) => removeBoardItem(state, id)),
      open: (id: string) => {
        if (!projects.some((project) => project.id === id)) {
          setMessage(w.unavailable);
          return;
        }
        onOpenCard(id);
      },
      editZone: (
        id: string,
        changes: {
          title?: string;
          width?: number;
          height?: number;
          x?: number;
          y?: number;
        },
      ) =>
        change(
          (state) => editBoardZone(state, id, changes),
          changes.title !== undefined ? "zone-title:" + id : "",
        ),
      convert: onConvertNote
        ? async (id: string, text: string) => {
            if (converting || !text.trim() || text.length > 1000) return;
            setConverting(id);
            try {
              const projectId = await onConvertNote?.(id, text);
              if (!projectId) throw new Error("planning-convert");
              change((state) => convertBoardNote(state, id, projectId));
            } catch {
              setMessage(t.localError);
            } finally {
              setConverting("");
            }
          }
        : undefined,
    }),
    [
      change,
      onOpenCard,
      onConvertNote,
      converting,
      t.localError,
      projects,
      w.unavailable,
    ],
  );
  const removeEdge = useCallback(
    (id: string) => change((state) => removeBoardThread(state, id)),
    [change],
  );
  useEffect(() => {
    const available = new Map(
      props.projects.map((project) => [project.id, project]),
    );
    setNodes((previous) =>
      view.state.items.flatMap((item) => {
        const project =
          item.kind === "card" ? available.get(item.projectId) : undefined;
        if (item.kind === "card" && !project) return [];
        const old = previous.find((node) => node.id === item.id);
        return [
          {
            // Preserve measured dimensions: hiding/re-measuring a focused node drops native keypresses.
            ...old,
            id: item.id,
            type: item.kind,
            position:
              dragging.current === item.id && old
                ? old.position
                : { x: item.x, y: item.y },
            selected: old?.selected,
            dragHandle: ".plan-node-grip",
            ...(item.kind === "zone"
              ? {
                  style: { width: item.width, height: item.height },
                  zIndex: -1,
                }
              : {}),
            data: {
              item,
              project,
              section:
                props.sections.find(
                  (section) => section.id === project?.sectionId,
                )?.name || "",
              language: props.language,
            },
          } as PlanningNode,
        ];
      }),
    );
  }, [
    view.state.items,
    props.projects,
    props.sections,
    props.language,
    setNodes,
  ]);
  // Project note text synchronously from the accepted model. An effect-delayed
  // data update would restore stale textarea values between fast keypresses.
  const currentItems = new Map(view.state.items.map((item) => [item.id, item]));
  const currentProjects = new Map(
    props.projects.map((project) => [project.id, project]),
  );
  const graphNodes: PlanningNode[] = nodes.flatMap((node) => {
    const item = currentItems.get(node.id);
    if (!item) return [];
    const project =
      item.kind === "card" ? currentProjects.get(item.projectId) : undefined;
    if (item.kind === "card" && !project) return [];
    return [
      {
        ...node,
        data: { ...node.data, item, project },
      },
    ];
  });
  const linkedProjectId = useCallback(
    (id: string) => {
      const item = repository.state.items.find((i) => i.id === id);
      return item?.kind === "card" ? item.projectId : id;
    },
    [repository],
  );
  const relationRows = experience?.view.state.relations;
  const effectiveState = useMemo(
    () => ({
      ...view.state,
      threads: view.state.threads.map((edge) => ({
        ...edge,
        kind:
          edge.kind ||
          relationRows?.find(
            (r) =>
              r.source ===
                cardKey(
                  linkedProjectId(edge.source),
                  props.scope || undefined,
                ) &&
              r.target ===
                cardKey(linkedProjectId(edge.target), props.scope || undefined),
          )?.kind ||
          ("related" as const),
      })),
    }),
    [view.state, relationRows, linkedProjectId, props.scope],
  );
  const updateThread = useCallback(
    (
      edgeId: string,
      changes: { kind?: ThreadKind; label?: string; reverse?: boolean },
      group = "",
    ) => {
      if (
        experience &&
        !experience.view.ready &&
        !experience.view.state.relations.length &&
        repository.state.threads.some((edge) => !edge.kind)
      ) {
        setMessage(t.localError);
        return;
      }
      change(
        (state) =>
          editBoardThread(
            {
              ...state,
              threads: state.threads.map((edge) => ({
                ...edge,
                kind:
                  edge.kind ||
                  effectiveState.threads.find((value) => value.id === edge.id)
                    ?.kind ||
                  "related",
              })),
            },
            edgeId,
            changes,
          ),
        group,
      );
    },
    [change, effectiveState, experience, repository, t.localError],
  );
  const setMeaning = useCallback(
    (edgeId: string, kind: ThreadKind) => updateThread(edgeId, { kind }),
    [updateThread],
  );
  const visibleIds = useMemo(
    () => new Set(nodes.map((node) => node.id)),
    [nodes],
  );
  useEffect(() => {
    setEdges(() =>
      view.state.threads
        .filter(
          (edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target),
        )
        .map((edge) => ({
          id: edge.id,
          type: "rope",
          source: edge.source,
          target: edge.target,
          sourceHandle: "pin",
          targetHandle: "pin",
          selected: focusedThread === edge.id,
          data: {
            remove: removeEdge,
            language: props.language,
            meaning:
              edge.kind ||
              relationRows?.find(
                (r) =>
                  r.source ===
                    cardKey(
                      linkedProjectId(edge.source),
                      props.scope || undefined,
                    ) &&
                  r.target ===
                    cardKey(
                      linkedProjectId(edge.target),
                      props.scope || undefined,
                    ),
              )?.kind ||
              "related",
            label: edge.label || "",
            sourceName:
              view.state.items.find((i) => i.id === edge.source)?.kind ===
              "card"
                ? props.projects.find(
                    (p) => p.id === linkedProjectId(edge.source),
                  )?.name || ""
                : t.note,
            targetName:
              view.state.items.find((i) => i.id === edge.target)?.kind ===
              "card"
                ? props.projects.find(
                    (p) => p.id === linkedProjectId(edge.target),
                  )?.name || ""
                : t.note,
            setMeaning: (kind: ThreadKind) => setMeaning(edge.id, kind),
            setLabel: (label: string) =>
              updateThread(edge.id, { label }, "thread:" + edge.id),
            reverse: () => updateThread(edge.id, { reverse: true }),
          },
        })),
    );
  }, [
    view.state.threads,
    focusedThread,
    visibleIds,
    props.language,
    props.scope,
    removeEdge,
    setEdges,
    repository,
    relationRows,
    linkedProjectId,
    setMeaning,
    updateThread,
    props.projects,
    t.note,
    view.state.items,
  ]);
  useEffect(() => {
    if (initialized && nodes.length && !fitted.current) {
      fitted.current = true;
      if (initialNavigation) void flow.setViewport(initialNavigation);
      else void flow.fitView({ padding: 0.3, maxZoom: 1 });
    }
  }, [initialized, nodes.length, flow, initialNavigation]);
  const neighborhood = boardNeighborhood(effectiveState, selectedItem);
  const projectStatus = new Map(props.projects.map((p) => [p.id, p.status]));
  const displayedNodes = graphNodes.map((node) => ({
    ...node,
    className:
      focusMode &&
      selectedItem &&
      !neighborhood.has(node.id) &&
      node.type !== "zone"
        ? "plan-dimmed"
        : "",
    data: {
      ...node.data,
      converting: converting === node.id,
      blockers: boardBlockers(effectiveState, node.id, projectStatus).map(
        (item) => ({
          id: item.projectId,
          name: currentProjects.get(item.projectId)?.name || w.unavailable,
        }),
      ),
    },
  }));
  const remember = () => {
    try {
      navigation.write({ ...flow.getViewport(), selected: selectedItem });
    } catch {
      setMessage(t.localError);
    }
  };
  const centerSelected = () => {
    if (selectedItem)
      void flow.fitView({
        nodes: [{ id: selectedItem }],
        padding: 0.6,
        maxZoom: 1,
        duration: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? 0
          : 250,
      });
  };
  const fitEverything = () => {
    const sizes = new Map(
      flow.getNodes().map((node) => [
        node.id,
        {
          width: node.measured?.width || 260,
          height: node.measured?.height || 220,
        },
      ]),
    );
    const bounds = boardBounds(repository.state, sizes);
    if (bounds)
      void flow.fitBounds(bounds, {
        padding: 0.2,
        duration: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? 0
          : 250,
      });
  };
  const place = (): Point => {
    const rect = container.current!.getBoundingClientRect(),
      count = repository.state.items.length;
    const center = flow.screenToFlowPosition({
      x: rect.left + rect.width / 2 - 110,
      y: rect.top + rect.height / 2 - 80,
    });
    const angle = count * 2.399,
      radius = Math.sqrt(count) * 72;
    return {
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius,
    };
  };
  const connect = (connection: Connection) => {
    if (!connection.source || !connection.target) return;
    const id = createClientId();
    change((state) =>
      connectBoardItems(state, id, connection.source!, connection.target!),
    );
    setFocusedThread(id);
  };
  const disabled = view.error === "invalid-local" || !!view.conflict;
  const saveWord = view.pending
    ? view.ready && !view.error
      ? t.saving
      : t.local
    : view.ready
      ? t.saved
      : t.local;
  const errorWord =
    view.error === "invalid-local"
      ? t.invalidLocal
      : view.error === "local"
        ? t.localError
        : view.error === "remote"
          ? t.remoteError
          : "";
  const invoke = (work: () => void) => {
    try {
      work();
      setMessage("");
    } catch {
      setMessage(t.localError);
    }
  };
  return (
    <PlanningActions value={actions}>
      <div
        className="planning-board-shell"
        dir={props.language === "en" ? "ltr" : "rtl"}
        onKeyDown={(event) => {
          const target = event.target as HTMLElement;
          if (target.matches("input,textarea") || target.isContentEditable)
            return;
          if (
            (event.ctrlKey || event.metaKey) &&
            event.key.toLowerCase() === "z"
          ) {
            event.preventDefault();
            invoke(() =>
              event.shiftKey ? repository.redo() : repository.undo(),
            );
          }
          if (event.key === "Escape" && mode === "pen") {
            event.preventDefault();
            event.stopPropagation();
            setMode("move");
          }
        }}
      >
        <header className="planning-toolbar">
          <div className="planning-title">
            <Network size={20} />
            <h2 id={titleId}>{t.title}</h2>
            <span
              className={`planning-save ${view.pending ? "is-pending" : ""}`}
              role="status"
            >
              {view.pending ? <LoaderCircle size={14} /> : <Check size={14} />}
              <span>{saveWord}</span>
            </span>
          </div>
          <div className="planning-actions" role="toolbar" aria-label={t.title}>
            <div className="planning-mode">
              <button
                type="button"
                aria-pressed={mode === "move"}
                title={t.select}
                aria-label={t.select}
                onClick={() => setMode("move")}
              >
                <Hand size={18} />
              </button>
              <button
                type="button"
                aria-pressed={mode === "thread"}
                aria-label={w.thread}
                title={w.thread}
                disabled={disabled}
                onClick={() => {
                  setMode("thread");
                  setPicker(false);
                }}
              >
                <Network size={18} />
              </button>
              <button
                type="button"
                aria-pressed={mode === "pen"}
                title={t.pen}
                aria-label={t.pen}
                onClick={() => {
                  setMode("pen");
                  setPicker(false);
                }}
                disabled={disabled}
              >
                <Pencil size={18} />
              </button>
            </div>
            <button
              type="button"
              className="planning-add"
              onClick={() => {
                setPicker((value) => !value);
                setMode("move");
              }}
              disabled={disabled}
            >
              <Plus size={17} />
              {t.card}
            </button>
            <button
              type="button"
              title={t.note}
              aria-label={t.note}
              disabled={disabled}
              onClick={() =>
                change((state) =>
                  addBoardNote(state, createClientId(), place()),
                )
              }
            >
              <StickyNote size={18} />
            </button>
            <button
              type="button"
              title={w.zone}
              aria-label={w.zone}
              disabled={disabled}
              onClick={() => {
                setMode("move");
                change((state) =>
                  addBoardZone(state, createClientId(), place(), w.zone),
                );
              }}
            >
              <Frame size={18} />
            </button>
            <button
              type="button"
              title={w.focus}
              aria-label={w.focus}
              aria-pressed={focusMode}
              onClick={() => {
                setFocusMode((v) => !v);
                setMode("move");
              }}
            >
              <Focus size={18} />
            </button>
            <button
              type="button"
              title={t.undo}
              aria-label={t.undo}
              disabled={!view.canUndo || disabled}
              onClick={() => invoke(() => repository.undo())}
            >
              <Undo2 size={18} />
            </button>
            <button
              type="button"
              title={t.redo}
              aria-label={t.redo}
              disabled={!view.canRedo || disabled}
              onClick={() => invoke(() => repository.redo())}
            >
              <Redo2 size={18} />
            </button>
            <button
              type="button"
              title={t.removeCircle}
              aria-label={t.removeCircle}
              disabled={!selectedCircle || disabled}
              onClick={() => {
                change((state) => removeBoardCircle(state, selectedCircle));
                setSelectedCircle("");
              }}
            >
              <Trash2 size={18} />
            </button>
            <details className="planning-help">
              <summary aria-label={t.help}>
                <CircleHelp size={18} />
              </summary>
              <div>
                <p>{t.helpText}</p>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    const url = URL.createObjectURL(
                      new Blob([JSON.stringify(repository.state, null, 2)], {
                        type: "application/json",
                      }),
                    );
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = "wilo-planning-board.json";
                    link.click();
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                  }}
                >
                  <Download size={15} />
                  {t.export}
                </button>
              </div>
            </details>
            <button
              type="button"
              className="planning-close"
              aria-label={t.close}
              title={t.close}
              onClick={props.onClose}
            >
              <X size={21} />
            </button>
          </div>
        </header>
        {view.conflict && (
          <div className="planning-notice" role="alert">
            <span>{t.conflict}</span>
            <button onClick={() => invoke(() => repository.resolve("local"))}>
              {t.keepLocal}
            </button>
            <button onClick={() => invoke(() => repository.resolve("remote"))}>
              {t.keepRemote}
            </button>
          </div>
        )}
        {experience &&
          (experience.view.pending ||
            experience.view.error ||
            experience.view.conflict) && (
            <section className="planning-relation-status" role="status">
              <span>
                {props.language === "ar"
                  ? "العلاقات: محفوظة محليًا، المزامنة مطلوبة"
                  : "Relationships: saved locally, sync pending"}
              </span>
              {experience.view.error && (
                <button onClick={() => experience.repository.retry()}>
                  {props.language === "ar" ? "إعادة المحاولة" : "Retry"}
                </button>
              )}
              {experience.view.conflict && (
                <>
                  <button
                    onClick={() => experience.repository.resolve("remote")}
                  >
                    {props.language === "ar"
                      ? "استخدام نسخة الحساب"
                      : "Use account copy"}
                  </button>
                  <button
                    onClick={() => experience.repository.resolve("local")}
                  >
                    {props.language === "ar"
                      ? "الاحتفاظ بتعديلي"
                      : "Keep my changes"}
                  </button>
                </>
              )}
            </section>
          )}
        {(message || errorWord) && (
          <div className="planning-notice" role="alert">
            <span>{message || errorWord}</span>
            {view.error === "remote" && (
              <button onClick={() => repository.retry()}>{t.retry}</button>
            )}
            <button
              type="button"
              aria-label={t.close}
              onClick={() => setMessage("")}
              disabled={!message}
            >
              <X size={15} />
            </button>
          </div>
        )}
        <div className="planning-mode-hint" role="status">
          {mode === "pen"
            ? w.modePen
            : mode === "thread"
              ? w.modeThread
              : w.modeMove}
          {focusMode && ` · ${w.focus}`}
        </div>
        <div ref={container} className="planning-canvas" dir="ltr">
          <ReactFlow<PlanningNode, PlanningEdge>
            nodes={displayedNodes}
            edges={edges.map((edge) => ({
              ...edge,
              data: edge.data
                ? {
                    ...edge.data,
                    label:
                      view.state.threads.find((value) => value.id === edge.id)
                        ?.label || "",
                    meaning:
                      effectiveState.threads.find(
                        (value) => value.id === edge.id,
                      )?.kind || "related",
                  }
                : undefined,
              style:
                focusMode &&
                selectedItem &&
                !neighborhood.has(edge.source) &&
                !neighborhood.has(edge.target)
                  ? { opacity: 0.12 }
                  : undefined,
            }))}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onNodeClick={(_event, node) => {
              setSelectedItem(node.id);
              try {
                navigation.write({ ...flow.getViewport(), selected: node.id });
              } catch {
                setMessage(t.localError);
              }
            }}
            onMoveEnd={() => remember()}
            onEdgesChange={(changes) => {
              const selected = changes.find(
                (change) => change.type === "select" && change.selected,
              );
              if (selected?.type === "select") setFocusedThread(selected.id);
              else if (
                changes.some(
                  (change) =>
                    change.type === "select" &&
                    !change.selected &&
                    change.id === focusedThread,
                )
              )
                setFocusedThread("");
              onEdgesChange(changes);
            }}
            onEdgeClick={(_event, edge) => setFocusedThread(edge.id)}
            onConnect={connect}
            connectionMode={ConnectionMode.Loose}
            connectionLineComponent={RopeConnection}
            connectionRadius={28}
            onNodeDragStart={(_event, node) => {
              dragging.current = node.id;
            }}
            onNodeDragStop={(_event, node) => {
              dragging.current = null;
              if (
                !change((state) => moveBoardItem(state, node.id, node.position))
              )
                setNodes((previous) =>
                  previous.map((item) => {
                    const saved = repository.state.items.find(
                      (value) => value.id === item.id,
                    );
                    return saved
                      ? { ...item, position: { x: saved.x, y: saved.y } }
                      : item;
                  }),
                );
            }}
            onNodesDelete={(removed) =>
              change((state) =>
                removed.reduce(
                  (next, node) => removeBoardItem(next, node.id),
                  state,
                ),
              )
            }
            onEdgesDelete={(removed) =>
              change((state) =>
                removed.reduce(
                  (next, edge) => removeBoardThread(next, edge.id),
                  state,
                ),
              )
            }
            nodesDraggable={mode === "move" && !disabled}
            nodesConnectable={mode !== "pen" && !disabled}
            elementsSelectable={mode !== "pen" && !disabled}
            panOnDrag={mode === "move"}
            snapToGrid={false}
            minZoom={0.2}
            maxZoom={2}
            translateExtent={[
              [-24000, -24000],
              [24000, 24000],
            ]}
            deleteKeyCode={disabled ? null : ["Backspace", "Delete"]}
            onPaneClick={() => {
              setSelectedCircle("");
              setFocusedThread("");
            }}
          ></ReactFlow>
          <CircleLayer
            circles={view.state.circles}
            drawing={mode === "pen" && !disabled}
            selected={selectedCircle}
            onSelect={setSelectedCircle}
            onDraw={(points) =>
              change((state) =>
                parsePlanningState({
                  ...state,
                  circles: [
                    ...state.circles,
                    recognizeCircle(points, createClientId()),
                  ],
                }),
              )
            }
          />
          {!nodes.length && !disabled && (
            <div className="planning-empty">
              <Network size={33} />
              <p>{t.empty}</p>
            </div>
          )}
          <div className="planning-zoom">
            <button
              type="button"
              title={w.locate}
              aria-label={w.locate}
              disabled={
                !selectedItem ||
                !view.state.items.some((item) => item.id === selectedItem)
              }
              onClick={centerSelected}
            >
              <LocateFixed size={18} />
            </button>
            <button
              type="button"
              title={t.zoomIn}
              aria-label={t.zoomIn}
              onClick={() => {
                void flow.zoomIn();
              }}
            >
              <ZoomIn size={18} />
            </button>
            <button
              type="button"
              title={t.zoomOut}
              aria-label={t.zoomOut}
              onClick={() => {
                void flow.zoomOut();
              }}
            >
              <ZoomOut size={18} />
            </button>
            <button
              type="button"
              title={t.fit}
              aria-label={t.fit}
              onClick={() => {
                fitEverything();
              }}
            >
              <Maximize2 size={18} />
            </button>
          </div>
          {picker && (
            <aside
              className="planning-card-picker"
              dir={props.language === "en" ? "ltr" : "rtl"}
            >
              <label>
                <Search size={16} />
                <input
                  type="search"
                  aria-label={t.search}
                  placeholder={t.search}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
              <div>
                {props.projects
                  .filter((project) =>
                    project.name
                      .toLocaleLowerCase()
                      .includes(query.toLocaleLowerCase()),
                  )
                  .map((project) => {
                    const added = view.state.items.some(
                      (item) =>
                        item.kind === "card" && item.projectId === project.id,
                    );
                    return (
                      <button
                        type="button"
                        key={project.id}
                        disabled={added}
                        title={added ? t.added : project.name}
                        onClick={() =>
                          change((state) =>
                            addBoardCard(state, project.id, place()),
                          )
                        }
                      >
                        <span dir="auto">{project.name}</span>
                        {added ? <Check size={16} /> : <Plus size={16} />}
                      </button>
                    );
                  })}
              </div>
            </aside>
          )}
        </div>
      </div>
    </PlanningActions>
  );
}

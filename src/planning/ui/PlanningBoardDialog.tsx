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
import { createPlanningRepository } from "../browserRepository";
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
} from "../domain";
import type { PlanningState, Point } from "../domain";
import {
  PlanningCardNode,
  PlanningNoteNode,
  RopeEdge,
  RopeConnection,
} from "./Nodes";
import type { PlanningNode, PlanningEdge } from "./Nodes";
import CircleLayer from "./CircleLayer";
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
};
const nodeTypes = { card: PlanningCardNode, note: PlanningNoteNode };
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
      <ReactFlowProvider>
        <PlanningCanvas
          {...props}
          titleId={title}
          repository={repository}
          view={view}
        />
      </ReactFlowProvider>
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
  const t = planningWords[props.language],
    container = useRef<HTMLDivElement>(null),
    dragging = useRef<string | null>(null),
    fitted = useRef(false);
  const [nodes, setNodes, onNodesChange] = useNodesState<PlanningNode>([]),
    [edges, setEdges, onEdgesChange] = useEdgesState<PlanningEdge>([]);
  const flow = useReactFlow<PlanningNode, PlanningEdge>(),
    initialized = useNodesInitialized();
  const [mode, setMode] = useState<"move" | "pen">("move"),
    [picker, setPicker] = useState(false),
    [query, setQuery] = useState(""),
    [selectedCircle, setSelectedCircle] = useState(""),
    [message, setMessage] = useState("");
  const change = useCallback(
    (update: (state: PlanningState) => PlanningState, historyGroup = "") => {
      try {
        repository.apply(update(repository.state), historyGroup);
        setMessage("");
      } catch (error) {
        const code = (error as { code?: string }).code;
        setMessage(
          code === "planning-circle"
            ? t.invalidCircle
            : code === "planning-full"
              ? t.full
              : code === "planning-local"
                ? t.localError
                : t.invalid,
        );
      }
    },
    [repository, t],
  );
  const { onClose, onOpenCard } = props;
  const actions = useMemo(
    () => ({
      editNote: (id: string, text: string) =>
        change((state) => editBoardNote(state, id, text), "note:" + id),
      remove: (id: string) => change((state) => removeBoardItem(state, id)),
      open: (id: string) => {
        onClose();
        onOpenCard(id);
      },
    }),
    [change, onClose, onOpenCard],
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
    if (node.data.item === item && node.data.project === project) return [node];
    return [{ ...node, data: { ...node.data, item, project } }];
  });
  const visibleIds = useMemo(
    () => new Set(nodes.map((node) => node.id)),
    [nodes],
  );
  useEffect(() => {
    setEdges((previous) =>
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
          selected: previous.find((value) => value.id === edge.id)?.selected,
          data: { remove: removeEdge, language: props.language },
        })),
    );
  }, [view.state.threads, visibleIds, props.language, removeEdge, setEdges]);
  useEffect(() => {
    if (initialized && nodes.length && !fitted.current) {
      fitted.current = true;
      void flow.fitView({ padding: 0.3, maxZoom: 1 });
    }
  }, [initialized, nodes.length, flow]);
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
    if (connection.source && connection.target)
      change((state) =>
        connectBoardItems(
          state,
          createClientId(),
          connection.source,
          connection.target,
        ),
      );
  };
  const disabled = view.error === "invalid-local";
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
        <div ref={container} className="planning-canvas" dir="ltr">
          <ReactFlow<PlanningNode, PlanningEdge>
            nodes={graphNodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={connect}
            connectionMode={ConnectionMode.Loose}
            connectionLineComponent={RopeConnection}
            connectionRadius={28}
            onNodeDragStart={(_event, node) => {
              dragging.current = node.id;
            }}
            onNodeDragStop={(_event, node) => {
              dragging.current = null;
              change((state) => moveBoardItem(state, node.id, node.position));
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
            nodesConnectable={mode === "move" && !disabled}
            elementsSelectable={mode === "move" && !disabled}
            panOnDrag={mode === "move"}
            snapToGrid={false}
            minZoom={0.2}
            maxZoom={2}
            translateExtent={[
              [-24000, -24000],
              [24000, 24000],
            ]}
            deleteKeyCode={disabled ? null : ["Backspace", "Delete"]}
            onPaneClick={() => setSelectedCircle("")}
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
                void flow.fitView({ padding: 0.3, maxZoom: 1 });
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

import type { Relation } from "../../productivity/state";
import { usePlanningActions } from "./actions";
import { useState } from "react";
import {
  Handle,
  Position,
  BaseEdge,
  EdgeLabelRenderer,
  useViewport,
  NodeResizer,
} from "@xyflow/react";
import type {
  Node,
  NodeProps,
  Edge,
  EdgeProps,
  ConnectionLineComponentProps,
} from "@xyflow/react";
import { ArrowUpRight, ArrowLeftRight, FileText, X } from "lucide-react";
import type { Project } from "../../types";
import type { Language } from "../../translations";
import type { BoardItem, ThreadKind } from "../domain";
import RoughMark from "../../components/pinboard/RoughMark";
import { boardWords } from "./detailsText";
import { planningWords } from "./text";
export type PlanningNode = Node<
  {
    item: BoardItem;
    project?: Project;
    section: string;
    language: Language;
    blockers?: { id: string; name: string }[];
    converting?: boolean;
  },
  "card" | "note" | "zone"
>;
export type PlanningEdge = Edge<
  {
    remove: (id: string) => void;
    language: Language;
    meaning?: ThreadKind;
    label?: string;
    sourceName?: string;
    targetName?: string;
    setLabel?: (text: string) => void;
    reverse?: () => void;
    setMeaning?: (kind: Relation["kind"]) => void;
  },
  "rope"
>;
export function PlanningCardNode({ data }: NodeProps<PlanningNode>) {
  const { zoom } = useViewport();
  const [marked, setMarked] = useState(false),
    actions = usePlanningActions(),
    t = planningWords[data.language],
    project = data.project,
    words = boardWords(data.language);
  if (!project) return null;
  return (
    <article
      className="plan-card"
      onPointerEnter={() => setMarked(true)}
      onPointerLeave={() => setMarked(false)}
      onFocus={() => setMarked(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setMarked(false);
      }}
      dir={data.language === "en" ? "ltr" : "rtl"}
    >
      <Handle
        type="source"
        id="pin"
        position={Position.Top}
        className="plan-pin"
        aria-label={`${t.thread}: ${project.name}`}
      />
      <button
        type="button"
        className="plan-remove nodrag nopan"
        aria-label={t.remove}
        onClick={() => actions.remove(data.item.id)}
      >
        <X size={14} />
      </button>
      <header className="plan-node-grip">
        <small>{data.section || "WILO"}</small>
        <h2 dir="auto">
          <RoughMark active={marked} rtl={data.language !== "en"} scale={zoom}>
            {project.name}
          </RoughMark>
        </h2>
      </header>
      <span className={`plan-card-status is-${project.status}`}>
        {words.status[project.status]}
      </span>
      {!!data.blockers?.length && (
        <div
          className="plan-blockers nodrag nopan"
          aria-label={words.blocked}
          title={words.blockedHint}
        >
          <small>{words.blocked}</small>
          {data.blockers.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => actions.open(item.id)}
            >
              {item.name}
            </button>
          ))}
        </div>
      )}
      <p className="plan-card-preview" dir="auto">
        {project.nextStep || project.checkpoint || project.description}
      </p>
      <footer>
        {project.dueDate && (
          <time dateTime={project.dueDate}>{project.dueDate}</time>
        )}
        <button
          type="button"
          className="plan-open nodrag nopan"
          onClick={() => actions.open(project.id)}
        >
          <ArrowUpRight size={14} />
          {t.open}
        </button>
      </footer>
    </article>
  );
}
export function PlanningNoteNode({ data }: NodeProps<PlanningNode>) {
  const actions = usePlanningActions(),
    t = planningWords[data.language],
    note = data.item;
  const sourceText = note.kind === "note" ? note.text : "";
  if (note.kind !== "note") return null;
  return (
    <article className="plan-note" dir={data.language === "en" ? "ltr" : "rtl"}>
      <Handle
        type="source"
        id="pin"
        position={Position.Top}
        className="plan-pin"
        aria-label={t.thread}
      />
      <header className="plan-node-grip">
        <FileText size={15} aria-hidden="true" />
        <span>{t.note}</span>
        <button
          type="button"
          className="plan-remove nodrag nopan"
          aria-label={t.remove}
          onClick={() => actions.remove(note.id)}
        >
          <X size={14} />
        </button>
      </header>
      <textarea
        className="nodrag nopan nowheel"
        aria-label={t.note}
        placeholder={t.notePlaceholder}
        value={sourceText}
        maxLength={2000}
        onChange={(event) => {
          actions.editNote(note.id, event.target.value);
        }}
        dir="auto"
      />
      {actions.convert && (
        <footer className="nodrag nopan">
          {sourceText.length > 1000 && (
            <small>{boardWords(data.language).longNote}</small>
          )}
          <button
            type="button"
            disabled={
              data.converting || !sourceText.trim() || sourceText.length > 1000
            }
            onClick={() => void actions.convert?.(note.id, sourceText)}
          >
            {data.converting
              ? boardWords(data.language).converting
              : boardWords(data.language).convert}
          </button>
        </footer>
      )}
    </article>
  );
}
export function PlanningZoneNode({ data, selected }: NodeProps<PlanningNode>) {
  const actions = usePlanningActions(),
    zone = data.item,
    t = planningWords[data.language],
    w = boardWords(data.language);
  if (zone.kind !== "zone") return null;
  return (
    <section
      className="plan-zone"
      dir={data.language === "en" ? "ltr" : "rtl"}
      aria-label={zone.title || w.zone}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={240}
        minHeight={180}
        maxWidth={4000}
        maxHeight={4000}
        onResizeEnd={(_event, size) =>
          actions.editZone(zone.id, {
            width: size.width,
            height: size.height,
            x: size.x,
            y: size.y,
          })
        }
      />
      <header className="plan-node-grip" title={w.zoneHint}>
        <span className="plan-zone-grip" aria-hidden="true">
          ⠿
        </span>
        <input
          className="nodrag nopan"
          aria-label={w.zoneTitle}
          maxLength={100}
          value={zone.title}
          onChange={(e) => actions.editZone(zone.id, { title: e.target.value })}
        />
        <button
          className="nodrag nopan"
          type="button"
          aria-label={t.remove}
          onClick={() => actions.remove(zone.id)}
        >
          <X size={14} />
        </button>
      </header>
    </section>
  );
}
function rope(x1: number, y1: number, x2: number, y2: number) {
  const sag = Math.min(120, Math.max(35, Math.hypot(x2 - x1, y2 - y1) * 0.14));
  return `M ${x1} ${y1} C ${x1 + (x2 - x1) * 0.25} ${y1 + sag}, ${x1 + (x2 - x1) * 0.75} ${y2 + sag}, ${x2} ${y2}`;
}
export function RopeEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  selected,
  data,
}: EdgeProps<PlanningEdge>) {
  const path = rope(sourceX, sourceY, targetX, targetY),
    x = (sourceX + targetX) / 2,
    y = (sourceY + targetY) / 2 + 30;
  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        interactionWidth={22}
        className="plan-rope-base"
      />
      <path d={path} className="plan-rope-strand" pointerEvents="none" />
      {!selected && data && (data.meaning !== "related" || !!data.label) && (
        <EdgeLabelRenderer>
          <span
            className="plan-thread-caption"
            dir={data.language === "en" ? "ltr" : "rtl"}
            style={{
              transform: `translate(-50%,-50%) translate(${x}px,${y}px)`,
            }}
          >
            {data.label ||
              `${data.sourceName} — ${boardWords(data.language)[data.meaning || "related"]} ${data.targetName}`}
          </span>
        </EdgeLabelRenderer>
      )}
      {selected && data && (
        <EdgeLabelRenderer>
          <div
            className="plan-edge-tools nodrag nopan"
            style={{
              transform: `translate(-50%,-50%) translate(${x}px,${y}px)`,
            }}
            dir={data.language === "en" ? "ltr" : "rtl"}
          >
            <small className="plan-thread-direction">
              {data.sourceName} → {data.targetName}
            </small>
            {data.setMeaning &&
              (["related", "part", "depends"] as const).map((kind) => (
                <button
                  type="button"
                  key={kind}
                  aria-pressed={data.meaning === kind}
                  onClick={() => data.setMeaning?.(kind)}
                >
                  {boardWords(data.language)[kind]}
                </button>
              ))}
            {data.reverse && (
              <button
                type="button"
                title={boardWords(data.language).reverse}
                aria-label={boardWords(data.language).reverse}
                onClick={data.reverse}
              >
                <ArrowLeftRight size={15} />
              </button>
            )}
            {data.setLabel && (
              <input
                aria-label={boardWords(data.language).label}
                placeholder={boardWords(data.language).label}
                value={data.label || ""}
                maxLength={240}
                onChange={(e) => data.setLabel?.(e.target.value)}
              />
            )}
            <button
              type="button"
              onClick={() => data.remove(id)}
              aria-label={planningWords[data.language].removeThread}
            >
              <X size={15} />
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
export function RopeConnection({
  fromX,
  fromY,
  toX,
  toY,
}: ConnectionLineComponentProps) {
  return (
    <path
      d={rope(fromX, fromY, toX, toY)}
      className="plan-rope-base"
      fill="none"
    />
  );
}

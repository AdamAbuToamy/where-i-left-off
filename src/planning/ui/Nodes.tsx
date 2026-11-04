import type { Relation } from "../../productivity/state";
import { usePlanningActions } from "./actions";
import { useState } from "react";
import {
  Handle,
  Position,
  BaseEdge,
  EdgeLabelRenderer,
  useViewport,
} from "@xyflow/react";
import type {
  Node,
  NodeProps,
  Edge,
  EdgeProps,
  ConnectionLineComponentProps,
} from "@xyflow/react";
import { ArrowUpRight, FileText, X } from "lucide-react";
import type { Project } from "../../types";
import type { Language } from "../../translations";
import type { BoardItem } from "../domain";
import RoughMark from "../../components/pinboard/RoughMark";
import { planningWords } from "./text";
export type PlanningNode = Node<
  { item: BoardItem; project?: Project; section: string; language: Language },
  "card" | "note"
>;
export type PlanningEdge = Edge<
  {
    remove: (id: string) => void;
    language: Language;
    meaning?: Relation["kind"];
    setMeaning?: (kind: Relation["kind"]) => void;
  },
  "rope"
>;
export function PlanningCardNode({ data }: NodeProps<PlanningNode>) {
  const { zoom } = useViewport();
  const [marked, setMarked] = useState(false),
    actions = usePlanningActions(),
    t = planningWords[data.language],
    project = data.project;
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
        {actions.convertNote && (
          <button
            type="button"
            className="plan-note-convert nodrag nopan"
            title={
              data.language === "ar" ? "تحويل إلى بطاقة" : "Convert to card"
            }
            aria-label={
              data.language === "ar" ? "تحويل إلى بطاقة" : "Convert to card"
            }
            onClick={() => actions.convertNote?.(note.id)}
          >
            <ArrowUpRight size={15} />
          </button>
        )}
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
    </article>
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
      {selected && data && (
        <EdgeLabelRenderer>
          <div
            className="plan-edge-tools nodrag nopan"
            style={{
              transform: `translate(-50%,-50%) translate(${x}px,${y}px)`,
            }}
          >
            {data.setMeaning &&
              (["related", "part", "depends"] as const).map((kind) => (
                <button
                  type="button"
                  key={kind}
                  aria-pressed={data.meaning === kind}
                  onClick={() => data.setMeaning?.(kind)}
                >
                  {data.language === "ar"
                    ? {
                        related: "مرتبط",
                        part: "جزء من",
                        depends: "يتوقف على",
                      }[kind]
                    : {
                        related: "Related",
                        part: "Part of",
                        depends: "Depends on",
                      }[kind]}
                </button>
              ))}
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

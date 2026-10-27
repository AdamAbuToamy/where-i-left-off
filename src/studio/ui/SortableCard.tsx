import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import StudioProjectCard from "./ProjectCard";
import { useStudio } from "./context";
type Props = Omit<Parameters<typeof StudioProjectCard>[0], "dragHandle">;
export default function SortableCard(props: Props) {
  const { state, t, busy } = useStudio(),
    disabled =
      busy ||
      state.data.scopes.find((scope) => scope.id === props.scopeId)?.role ===
        "member";
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({ id: props.project.id, disabled });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 15 : undefined,
        position: "relative",
      }}
      className={
        "st-sortable" +
        (isDragging ? " is-dragging" : "") +
        (isOver ? " is-over" : "")
      }
    >
      <StudioProjectCard
        {...props}
        dragHandle={
          <button
            type="button"
            className="st-drag-handle"
            {...attributes}
            {...listeners}
            disabled={disabled}
            aria-label={t("reorder") + " " + props.project.name}
          >
            <GripVertical size={16} />
          </button>
        }
      />
    </div>
  );
}

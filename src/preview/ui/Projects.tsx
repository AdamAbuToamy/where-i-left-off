import { rankForMove } from "../../lib/projects";
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useSensors,
  useSensor,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Project } from "../../types";
import {
  Plus,
  Search,
  Filter,
  Folder,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Check,
  Pencil,
  Trash2,
  Archive,
  ExternalLink,
} from "lucide-react";
import LinkedText from "../../components/LinkedText";
import { normalizeSearch } from "../core/selectors";
import { usePreview } from "./context";
import Disclosure from "./Disclosure";
export default function Projects() {
  const { state, t, route, edit, act, notify } = usePreview(),
    [search, setSearch] = useState(""),
    [section, setSection] = useState("all"),
    [filter, setFilter] = useState("all"),
    [chosen, setChosen] = useState<string[]>([]),
    [page, setPage] = useState(0);
  const scope =
      state.data.scopes.find((item) => item.id === route.scope) ||
      state.data.scopes[0],
    readonly = scope.role === "member";
  const ordered = scope.projects
    .filter((project) => !project.trashedAt)
    .sort((a, b) => a.rank - b.rank || a.id.localeCompare(b.id));
  const filtered = ordered.filter(
    (project) =>
      (filter === "archive" ? !!project.archivedAt : !project.archivedAt) &&
      (filter === "all" || filter === "archive" || project.status === filter) &&
      (section === "all" || project.sectionId === section) &&
      normalizeSearch(
        project.name +
          " " +
          project.nextStep +
          " " +
          (project.description || ""),
      ).includes(normalizeSearch(search)),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 20)),
    current = Math.min(page, pages - 1),
    canDrag = !readonly && !search && section === "all" && filter === "all";
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 7 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  async function reorder(id: string, over: string) {
    try {
      const rank = rankForMove(ordered, id, over);
      if (rank !== null)
        await act([
          {
            target: "projects",
            action: "update",
            scope: scope.id,
            id,
            values: { rank },
          },
        ]);
    } catch {
      notify(t("error"));
    }
  }
  return (
    <section>
      <header className="preview-page-title">
        <h2>
          <Folder size={25} />
          {t("projects")}
        </h2>
        <button
          className="primary-button"
          disabled={readonly}
          onClick={() => edit({ kind: "project" })}
        >
          <Plus size={18} />
          {t("newCard")}
        </button>
      </header>
      {state.data.scopes.length > 1 && (
        <label className="preview-filter">
          {t("projects")}
          <select
            value={scope.id}
            onChange={(event) => {
              location.hash =
                "/admin/preview?screen=projects&scope=" +
                encodeURIComponent(event.target.value);
              setChosen([]);
              setPage(0);
            }}
          >
            {state.data.scopes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <Disclosure
        title={
          <>
            <Filter size={17} />
            {t("filters")}
          </>
        }
      >
        <div className="preview-filter-row">
          <label>
            <Search size={16} />
            {t("search")}
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
            />
          </label>
          <label>
            {t("status")}
            <select
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setPage(0);
              }}
            >
              {(
                [
                  "all",
                  "active",
                  "later",
                  "waiting",
                  "done",
                  "archive",
                ] as const
              ).map((value) => (
                <option key={value} value={value}>
                  {value === "archive" ? t("archived") : t(value)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("section")}
            <select
              value={section}
              onChange={(e) => {
                setSection(e.target.value);
                setPage(0);
              }}
            >
              <option value="all">{t("all")}</option>
              {scope.sections.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Disclosure>
      <Disclosure
        title={
          <>
            <Folder size={17} />
            {t("section")}
          </>
        }
      >
        <div className="preview-actions">
          {scope.sections.map((item) => (
            <button
              className="secondary-button"
              disabled={readonly}
              key={item.id}
              onClick={() => edit({ kind: "section", value: item })}
            >
              {item.name}
              <Pencil size={14} />
            </button>
          ))}
          <button
            className="text-button"
            disabled={readonly}
            onClick={() => edit({ kind: "section" })}
          >
            <Plus size={16} />
            {t("section")}
          </button>
        </div>
      </Disclosure>
      {!!chosen.length && (
        <motion.div
          className="preview-bulk"
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <strong>{chosen.length}</strong>
          <button
            className="secondary-button"
            onClick={() =>
              void act(
                chosen.map((id) => ({
                  target: "projects",
                  action: "update",
                  scope: scope.id,
                  id,
                  values: { status: "done" },
                })),
              ).then((ok) => {
                if (ok) setChosen([]);
              })
            }
          >
            <Check size={16} />
            {t("complete")}
          </button>
          <button
            className="secondary-button"
            onClick={() =>
              void act(
                chosen.map((id) => ({
                  target: "projects",
                  action: "update",
                  scope: scope.id,
                  id,
                  values: { archivedAt: Date.now() },
                })),
              ).then((ok) => {
                if (ok) setChosen([]);
              })
            }
          >
            <Archive size={16} />
            {t("archive")}
          </button>
          <button className="text-button" onClick={() => setChosen([])}>
            {t("cancel")}
          </button>
        </motion.div>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={(args) => {
          const hits = pointerWithin(args);
          return hits.length ? hits : closestCenter(args);
        }}
        onDragEnd={(event) => {
          if (event.over && canDrag)
            void reorder(String(event.active.id), String(event.over.id));
        }}
      >
        <SortableContext
          items={filtered
            .slice(current * 20, current * 20 + 20)
            .map((project) => project.id)}
          strategy={rectSortingStrategy}
        >
          <div className="preview-project-grid">
            <AnimatePresence initial={false}>
              {filtered
                .slice(current * 20, current * 20 + 20)
                .map((project) => (
                  <Card
                    key={project.id}
                    project={project}
                    scope={scope.id}
                    readonly={readonly}
                    canDrag={canDrag}
                    checked={chosen.includes(project.id)}
                    select={() =>
                      setChosen((old) =>
                        old.includes(project.id)
                          ? old.filter((id) => id !== project.id)
                          : old.length < 20
                            ? [...old, project.id]
                            : old,
                      )
                    }
                    move={(direction) => {
                      const index = ordered.findIndex(
                          (item) => item.id === project.id,
                        ),
                        other = ordered[index + direction];
                      if (other) void reorder(project.id, other.id);
                    }}
                  />
                ))}
            </AnimatePresence>
          </div>
        </SortableContext>
      </DndContext>
      {!filtered.length && <p className="empty-state">{t("empty")}</p>}
      {pages > 1 && (
        <nav className="preview-pagination" aria-label={t("projects")}>
          <button
            className="secondary-button"
            disabled={!current}
            onClick={() => setPage(current - 1)}
          >
            {t("previous")}
          </button>
          <span>
            {current + 1}/{pages}
          </span>
          <button
            className="secondary-button"
            disabled={current + 1 === pages}
            onClick={() => setPage(current + 1)}
          >
            {t("next")}
          </button>
        </nav>
      )}
    </section>
  );
}
function Card({
  project,
  scope,
  readonly,
  canDrag,
  checked,
  select,
  move,
}: {
  project: Project;
  scope: string;
  readonly: boolean;
  canDrag: boolean;
  checked: boolean;
  select: () => void;
  move: (direction: number) => void;
}) {
  const { t, act, edit } = usePreview(),
    { attributes, listeners, setNodeRef, transform, transition, isDragging } =
      useSortable({ id: project.id, disabled: !canDrag });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: transition,
        zIndex: isDragging ? 2 : undefined,
      }}
    >
      <motion.article
        layout
        className={
          "project-card preview-project " + (isDragging ? "is-dragging" : "")
        }
        initial={{ opacity: 0, y: 7 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97 }}
        data-preview-project={project.id}
      >
        <header>
          <span className="preview-status">{t(project.status)}</span>
          <div className="preview-actions">
            <input
              type="checkbox"
              disabled={readonly}
              checked={checked}
              aria-label={t("select") + " " + project.name}
              onChange={select}
            />
            <button
              className="preview-icon"
              disabled={!canDrag}
              aria-label={"↕ " + project.name}
              {...attributes}
              {...listeners}
              style={{ touchAction: "none" }}
            >
              <GripVertical size={18} />
            </button>
          </div>
        </header>
        <h3 dir="auto">{project.name}</h3>
        <p className="preview-next-step" dir="auto">
          {project.nextStep || "—"}
        </p>
        {project.dueDate && <time>{project.dueDate}</time>}
        {project.projectUrl && (
          <a
            className="preview-resource-link"
            href={project.projectUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink size={16} />
            {t("url")}
          </a>
        )}
        <Disclosure title={t("options")}>
          <p dir="auto">
            <LinkedText
              text={project.description || project.checkpoint || ""}
            />
          </p>
          <div className="preview-actions">
            <button
              className="text-button"
              disabled={readonly}
              onClick={() => edit({ kind: "project", value: project })}
            >
              <Pencil size={16} />
              {t("edit")}
            </button>
            <button
              className="text-button"
              disabled={readonly}
              onClick={() =>
                void act([
                  {
                    target: "projects",
                    action: "update",
                    scope,
                    id: project.id,
                    values: {
                      status: project.status === "done" ? "active" : "done",
                    },
                  },
                ])
              }
            >
              <Check size={16} />
              {t(project.status === "done" ? "active" : "complete")}
            </button>
            <button
              className="text-button"
              disabled={readonly}
              onClick={() =>
                void act([
                  {
                    target: "projects",
                    action: "update",
                    scope,
                    id: project.id,
                    values: { archivedAt: project.archivedAt ? 0 : Date.now() },
                  },
                ])
              }
            >
              <Archive size={16} />
              {t(project.archivedAt ? "restore" : "archive")}
            </button>
            <button
              className="text-button preview-danger"
              disabled={readonly}
              onClick={() =>
                void act([
                  {
                    target: "projects",
                    action: "trash",
                    scope,
                    id: project.id,
                  },
                ])
              }
            >
              <Trash2 size={16} />
              {t("remove")}
            </button>
            <button
              className="preview-icon"
              disabled={!canDrag}
              aria-label={t("previous") + " " + project.name}
              onClick={() => move(-1)}
            >
              <ArrowUp size={16} />
            </button>
            <button
              className="preview-icon"
              disabled={!canDrag}
              aria-label={t("next") + " " + project.name}
              onClick={() => move(1)}
            >
              <ArrowDown size={16} />
            </button>
          </div>
        </Disclosure>
      </motion.article>
    </div>
  );
}

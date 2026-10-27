import {
  DndContext,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensors,
  useSensor,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { useState } from "react";
import {
  Plus,
  LayoutGrid,
  List,
  Filter,
  Archive,
  Check,
  MoveRight,
  FolderPlus,
  Users,
} from "lucide-react";
import { AnimatePresence } from "motion/react";
import { rankForMove } from "../../lib/projects";
import { normalizeSearch } from "../core/selectors";
import { useStudio } from "./context";
import { navigateStudio, useStudioSearch } from "./navigation";
import { EmptyState, MoreMenu, StudioDialog } from "./primitives";
import SortableCard from "./SortableCard";
export default function ProjectsPage() {
  const { state, route, t, run, edit, now, notify } = useStudio();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 7 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const [search, setSearch] = useStudioSearch();
  const [selected, setSelected] = useState<string[]>([]),
    [moving, setMoving] = useState(false);
  const section = route.section,
    status = route.filter;
  const setSection = (section: string) => navigateStudio({ section });
  const setStatus = (filter: string) => navigateStudio({ filter });
  const teams = state.data.scopes.filter((s) => s.id !== "personal");
  const scope = state.data.scopes.find(
    (s) =>
      s.id ===
      (route.screen === "groups"
        ? route.scope === "personal"
          ? teams[0]?.id
          : route.scope
        : "personal"),
  );
  if (!scope)
    return (
      <EmptyState
        title={t("groups")}
        action={
          <button
            className="st-primary"
            onClick={() => edit({ kind: "group" })}
          >
            {t("newGroup")}
          </button>
        }
      />
    );
  const rows = scope.projects
    .filter(
      (p) =>
        !p.archivedAt &&
        !p.trashedAt &&
        (section === "all" || p.sectionId === section) &&
        (status === "all" ||
          (status === "overdue"
            ? p.status !== "done" &&
              !!p.dueDate &&
              p.dueDate < new Date(now).toLocaleDateString("en-CA")
            : status === "upcoming"
              ? p.status !== "done" &&
                !!p.dueDate &&
                p.dueDate >= new Date(now).toLocaleDateString("en-CA")
              : p.status === status)) &&
        normalizeSearch(
          [p.name, p.nextStep, p.description, p.checkpoint].join(" "),
        ).includes(normalizeSearch(search)),
    )
    .sort((a, b) => a.rank - b.rank || a.id.localeCompare(b.id));
  const ids = selected.filter((id) => rows.some((p) => p.id === id));
  const bulk = async (values: Record<string, unknown>) => {
    if (
      await run({
        kind: "actions",
        actions: ids.map((id) => ({
          target: "projects",
          action: "update",
          scope: scope.id,
          id,
          values,
        })),
      })
    ) {
      setSelected([]);
      setMoving(false);
    }
  };
  const move = (id: string, direction: -1 | 1) => {
    const index = rows.findIndex((p) => p.id === id),
      over = rows[index + direction];
    if (!over) return;
    const rank = rankForMove(rows, id, over.id);
    if (rank !== null)
      void run({
        kind: "actions",
        actions: [
          {
            target: "projects",
            action: "update",
            scope: scope.id,
            id,
            values: { rank },
          },
        ],
      });
  };
  return (
    <section className="st-projects">
      <header className="st-section-header">
        <div>
          <span className="st-eyebrow">
            {route.screen === "groups" ? t("groups") : t("projects")}
          </span>
          <h1 dir="auto">{scope.name}</h1>
          <p>
            {scope.projects.filter((p) => !p.archivedAt && !p.trashedAt).length}{" "}
            {t("cards")} · {t("bulkHint")}
          </p>
        </div>
        <button
          className="st-primary"
          disabled={scope.role === "member"}
          onClick={() => edit({ kind: "project", scope: scope.id })}
        >
          <Plus size={18} />
          {t("newCard")}
        </button>
      </header>
      {route.screen === "groups" && (
        <div className="st-tab-row">
          {teams.map((team) => (
            <button
              key={team.id}
              aria-pressed={team.id === scope.id}
              onClick={() => {
                navigateStudio({ scope: team.id, item: "" });
                setSelected([]);
              }}
            >
              <Users size={15} />
              <span dir="auto">{team.name}</span>
            </button>
          ))}
          <button onClick={() => edit({ kind: "group" })}>
            <Plus size={16} />
            {t("newGroup")}
          </button>
        </div>
      )}
      {scope.role === "member" && <p className="st-notice">{t("readOnly")}</p>}
      <div className="st-workspace-tools">
        <label className="st-search-field">
          <span className="st-sr-only">{t("search")}</span>
          <input
            type="search"
            placeholder={t("search")}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              navigateStudio({ query: event.target.value });
            }}
          />
        </label>
        <label className="st-filter">
          <Filter size={16} />
          <span className="st-sr-only">{t("status")}</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="all">{t("all")}</option>
            {(["active", "later", "waiting", "done"] as const).map((value) => (
              <option value={value} key={value}>
                {t(value)}
              </option>
            ))}
          </select>
        </label>
        <div className="st-view-toggle">
          <button
            aria-label={t("cards")}
            aria-pressed={state.settings.view === "cards"}
            onClick={() =>
              void run({ kind: "settings", values: { view: "cards" } })
            }
          >
            <LayoutGrid size={17} />
          </button>
          <button
            aria-label={t("list")}
            aria-pressed={state.settings.view === "list"}
            onClick={() =>
              void run({ kind: "settings", values: { view: "list" } })
            }
          >
            <List size={18} />
          </button>
        </div>
      </div>
      <nav className="st-section-pills" aria-label={t("section")}>
        <button
          aria-pressed={section === "all"}
          onClick={() => setSection("all")}
        >
          {t("allSections")}
        </button>
        {scope.sections.map((s) => (
          <button
            aria-pressed={section === s.id}
            key={s.id}
            onClick={() => setSection(s.id)}
          >
            <span dir="auto">{s.name}</span>
            <small>
              {
                scope.projects.filter(
                  (p) => !p.archivedAt && !p.trashedAt && p.sectionId === s.id,
                ).length
              }
            </small>
          </button>
        ))}
        <button
          onClick={() => edit({ kind: "section", scope: scope.id })}
          disabled={scope.role === "member"}
        >
          <FolderPlus size={16} />
          {t("newSection")}
        </button>
        {scope.sections.find((value) => value.id === section) && (
          <MoreMenu>
            <button
              onClick={() =>
                edit({
                  kind: "section",
                  scope: scope.id,
                  value: scope.sections.find((value) => value.id === section),
                })
              }
            >
              {t("edit")} ·{" "}
              {scope.sections.find((value) => value.id === section)?.name}
            </button>
            <button
              onClick={() =>
                void run({
                  kind: "actions",
                  actions: [
                    {
                      target: "sections",
                      action: "delete",
                      scope: scope.id,
                      id: section,
                    },
                  ],
                }).then((ok) => {
                  if (ok) setSection("all");
                })
              }
            >
              {t("delete")}
            </button>
          </MoreMenu>
        )}
      </nav>
      {ids.length > 0 && (
        <div className="st-bulk">
          <strong>
            {ids.length} {t("selected")}
          </strong>
          <button onClick={() => void bulk({ status: "done" })}>
            <Check size={16} />
            {t("complete")}
          </button>
          <button onClick={() => setMoving(true)}>
            <MoveRight size={16} />
            {t("move")}
          </button>
          <button onClick={() => void bulk({ archivedAt: now })}>
            <Archive size={16} />
            {t("archive")}
          </button>
          <button onClick={() => setSelected([])}>{t("cancel")}</button>
        </div>
      )}
      {!rows.length ? (
        <EmptyState
          action={
            search || section !== "all" || status !== "all" ? (
              <button
                className="st-secondary"
                onClick={() => {
                  setSearch("");
                  navigateStudio({ query: "", section: "all", filter: "all" });
                }}
              >
                {t("clearFilters")}
              </button>
            ) : (
              <button
                className="st-primary"
                onClick={() => edit({ kind: "project", scope: scope.id })}
              >
                {t("newCard")}
              </button>
            )
          }
        />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          accessibility={{
            screenReaderInstructions: { draggable: t("reorderHelp") },
          }}
          onDragEnd={(event) => {
            if (!event.over || event.active.id === event.over.id) return;
            try {
              const rank = rankForMove(
                scope.projects,
                String(event.active.id),
                String(event.over.id),
              );
              if (rank !== null)
                void run({
                  kind: "actions",
                  actions: [
                    {
                      target: "projects",
                      action: "update",
                      scope: scope.id,
                      id: String(event.active.id),
                      values: { rank },
                    },
                  ],
                });
            } catch {
              notify(t("failed"));
            }
          }}
        >
          <SortableContext
            items={rows.map((project) => project.id)}
            strategy={
              state.settings.view === "list"
                ? verticalListSortingStrategy
                : rectSortingStrategy
            }
          >
            <div
              className={
                "st-project-grid " +
                (state.settings.view === "list" ? "is-list" : "")
              }
            >
              <AnimatePresence initial={false}>
                {rows.map((project) => (
                  <SortableCard
                    key={project.id}
                    project={project}
                    scopeId={scope.id}
                    selected={ids.includes(project.id)}
                    select={() => {
                      if (ids.length >= 50 && !ids.includes(project.id)) {
                        notify(t("bulkLimit"));
                        return;
                      }
                      setSelected((old) =>
                        old.includes(project.id)
                          ? old.filter((id) => id !== project.id)
                          : [...old, project.id],
                      );
                    }}
                    move={(direction) => move(project.id, direction)}
                  />
                ))}
              </AnimatePresence>
            </div>
          </SortableContext>
        </DndContext>
      )}
      {moving && (
        <StudioDialog title={t("moveHint")} close={() => setMoving(false)}>
          <div className="st-action-list">
            <button onClick={() => void bulk({ sectionId: "" })}>
              {t("unassigned")}
            </button>
            {scope.sections.map((s) => (
              <button
                key={s.id}
                dir="auto"
                onClick={() => void bulk({ sectionId: s.id })}
              >
                {s.name}
              </button>
            ))}
          </div>
        </StudioDialog>
      )}
    </section>
  );
}

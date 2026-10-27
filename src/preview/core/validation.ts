import { ProjectEntity } from "../../lib/projectEntity";
import { validDate } from "../../lib/projects";
import { backgrounds, themes } from "../../lib/appearanceCatalog";
import { parsePlanBackup } from "../../university/planImport";
import { PreviewError } from "./model";
import type { PreviewState, PreviewJournal } from "./model";

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new PreviewError("invalid");
  return value as Record<string, unknown>;
}
function text(value: unknown, max = 600): asserts value is string {
  if (typeof value !== "string" || value.length > max)
    throw new PreviewError("invalid");
}
function id(value: unknown): asserts value is string {
  text(value);
  if (!/^[-\w]+$/.test(value)) throw new PreviewError("invalid");
}
function list(value: unknown, max: number): asserts value is unknown[] {
  if (!Array.isArray(value) || value.length > max)
    throw new PreviewError("invalid");
}
function unique(values: unknown[], key: string) {
  const keys = values.map((v) => record(v)[key]);
  if (new Set(keys).size !== keys.length) throw new PreviewError("invalid");
}
export function validatePreviewState(input: unknown): PreviewState {
  const state = structuredClone(record(input));
  if (state.version !== 1) throw new PreviewError("invalid");
  const data = record(state.data),
    study = record(data.study);
  const parsed = parsePlanBackup(study);
  // The existing planner retains imported course materials; do not discard them on validation.
  for (const field of ["courses", "tasks", "lessons"] as const) {
    if (parsed[field].length !== (study[field] as unknown[]).length)
      throw new PreviewError("invalid");
  }
  list(data.scopes, 100);
  unique(data.scopes, "id");
  let projects = 0;
  for (const raw of data.scopes) {
    const scope = record(raw);
    id(scope.id);
    text(scope.name, 300);
    if (
      scope.role !== undefined &&
      !["manager", "member"].includes(String(scope.role))
    )
      throw new PreviewError("invalid");
    list(scope.sections, 1000);
    list(scope.projects, 5000);
    unique(scope.sections, "id");
    unique(scope.projects, "id");
    for (const rawSection of scope.sections) {
      const section = record(rawSection);
      id(section.id);
      text(section.name, 60);
      if (!section.name.trim()) throw new PreviewError("invalid");
    }
    for (const rawProject of scope.projects) {
      const p = record(rawProject);
      id(p.id);
      ProjectEntity.restore(p as unknown as import("../../types").Project);
      if (
        p.sectionId &&
        !scope.sections.some((s) => record(s).id === p.sectionId)
      )
        throw new PreviewError("invalid");
    }
    projects += scope.projects.length;
  }
  if (
    projects > 5000 ||
    !data.scopes.some((scope) => record(scope).id === "personal")
  )
    throw new PreviewError("invalid");
  list(state.semesters, 100);
  unique(state.semesters, "id");
  for (const raw of state.semesters) {
    const term = record(raw);
    id(term.id);
    text(term.name, 100);
    if (
      !term.name.trim() ||
      typeof term.archived !== "boolean" ||
      typeof term.start !== "string" ||
      typeof term.end !== "string" ||
      !validDate(term.start) ||
      !validDate(term.end) ||
      (term.start && term.end && term.start > term.end)
    )
      throw new PreviewError("invalid");
  }
  const assignments = record(state.courseSemesters);
  for (const [course, semester] of Object.entries(assignments)) {
    if (
      !parsed.courses.some((c) => c.id === course) ||
      !state.semesters.some((s) => record(s).id === semester)
    )
      throw new PreviewError("invalid");
  }
  list(state.reminders, 5000);
  if (
    new Set(state.reminders).size !== state.reminders.length ||
    state.reminders.some(
      (v) => !parsed.tasks.some((t) => t.id === v && !!t.due && !t.done),
    )
  )
    throw new PreviewError("invalid");
  list(state.sessions, 1000);
  unique(state.sessions, "id");
  for (const raw of state.sessions) {
    const session = record(raw);
    id(session.id);
    id(session.targetId);
    text(session.name, 500);
    if (
      !Number.isFinite(session.seconds) ||
      Number(session.seconds) < 1 ||
      Number(session.seconds) > 86400 ||
      !Number.isFinite(session.endedAt) ||
      Number(session.endedAt) < 0
    )
      throw new PreviewError("invalid");
  }
  const settings = record(state.settings);
  text(settings.displayName, 100);
  if (
    !settings.displayName.trim() ||
    !["ar", "en", "he"].includes(String(settings.language)) ||
    !["light", "dark"].includes(String(settings.mode)) ||
    !themes.includes(settings.theme as never) ||
    !backgrounds.includes(settings.background as never) ||
    !["cards", "list"].includes(String(settings.view)) ||
    ![7, 14, 30, 60, 90].includes(Number(settings.reviewDays))
  )
    throw new PreviewError("invalid");
  for (const field of ["enabled", "autoArchive", "reminders", "desktop"])
    if (typeof settings[field] !== "boolean") throw new PreviewError("invalid");
  return state as unknown as PreviewState;
}
export function validatePreviewJournal(input: unknown): PreviewJournal {
  const journal = record(input);
  if (
    journal.version !== 1 ||
    !Number.isSafeInteger(journal.revision) ||
    Number(journal.revision) < 0
  )
    throw new PreviewError("invalid");
  list(journal.undo, 20);
  list(journal.redo, 20);
  return {
    version: 1,
    revision: Number(journal.revision),
    current: validatePreviewState(journal.current),
    undo: journal.undo.map(validatePreviewState),
    redo: journal.redo.map(validatePreviewState),
    checkpoint:
      journal.checkpoint === null
        ? null
        : validatePreviewState(journal.checkpoint),
  };
}

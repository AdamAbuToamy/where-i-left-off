import { planAssistantChanges } from "../../assistant/actions";
import type { Change } from "../../assistant/actions";
import { parseControls } from "../../assistant/controlContract";
import { validateStudioState } from "./validation";
import { StudioError } from "./model";
import type { StudioCommand, StudioState } from "./model";

/** A model proposal and a UI command pass the same existing domain planners. No storage here. */
export function applyStudioChanges(
  state: StudioState,
  changes: Change[],
): StudioState {
  const next = structuredClone(state);
  for (const change of changes) {
    const scope = next.data.scopes.find((s) => s.id === change.scope);
    if (!scope || scope.role === "member") throw new StudioError("permission");
    const items =
      change.target === "projects"
        ? scope.projects
        : change.target === "sections"
          ? scope.sections
          : next.data.study[change.target];
    const index = items.findIndex((item) => item.id === change.id);
    const before = index < 0 ? null : items[index];
    if (JSON.stringify(before) !== JSON.stringify(change.before))
      throw new StudioError("conflict");
    if (change.after && (change.after as { id?: unknown }).id !== change.id)
      throw new StudioError("invalid");
    if (change.target === "projects") {
      const old = before as import("../../types").Project | null,
        after = change.after as import("../../types").Project | null;
      if (after && after.revision !== (old ? old.revision + 1 : 0))
        throw new StudioError("invalid");
      if (!after && (!old?.trashedAt || change.scope !== "personal"))
        throw new StudioError("permission");
    }
    if (index >= 0) items.splice(index, 1);
    if (change.after) (items as unknown[]).push(structuredClone(change.after));
  }
  for (const id of Object.keys(next.courseSemesters))
    if (!next.data.study.courses.some((c) => c.id === id))
      delete next.courseSemesters[id];
  next.reminders = next.reminders.filter((id) =>
    next.data.study.tasks.some((t) => t.id === id && !t.done && !!t.due),
  );
  return validateStudioState(next);
}
export function executeStudioCommand(
  state: StudioState,
  command: StudioCommand,
  now: number,
): StudioState {
  if (command.kind === "actions") {
    const actions = command.actions.map((action) =>
      state.settings.autoArchive &&
      action.target === "projects" &&
      action.values?.status === "done"
        ? { ...action, values: { ...action.values, archivedAt: now } }
        : action,
    );
    const changes = planAssistantChanges(state.data, actions, now);
    const next = applyStudioChanges(state, changes);
    if (command.semesterId)
      for (const change of changes)
        if (change.target === "courses" && !change.before && change.after)
          next.courseSemesters[change.id] = command.semesterId;
    return validateStudioState(next);
  }
  if (command.kind === "replace") return validateStudioState(command.state);
  const next = structuredClone(state);
  switch (command.kind) {
    case "proposal": {
      const changed = applyStudioChanges(next, command.proposal.changes);
      for (const control of parseControls(command.proposal.controls)) {
        if (control.kind === "navigate" || control.kind === "tour") continue;
        if (control.kind === "language")
          changed.settings.language = control.values
            .language as StudioState["settings"]["language"];
        else Object.assign(changed.settings, control.values);
      }
      return validateStudioState(changed);
    }
    case "semester": {
      const index = next.semesters.findIndex((s) => s.id === command.value.id);
      if (index < 0) next.semesters.push(command.value);
      else next.semesters[index] = command.value;
      break;
    }
    case "assign-semester":
      if (!next.data.study.courses.some((c) => c.id === command.courseId))
        throw new StudioError("invalid");
      if (command.semesterId)
        next.courseSemesters[command.courseId] = command.semesterId;
      else delete next.courseSemesters[command.courseId];
      break;
    case "settings":
      Object.assign(next.settings, command.values);
      break;
    case "reminder":
      next.reminders = next.reminders.includes(command.taskId)
        ? next.reminders.filter((id) => id !== command.taskId)
        : [...next.reminders, command.taskId];
      break;
    case "session":
      next.sessions = [...next.sessions, command.value].slice(-1000);
      break;
    case "group":
      next.data.scopes.push({
        id: command.id,
        name: command.name,
        role: "manager",
        projects: [],
        sections: [],
      });
      break;
    default:
      throw new StudioError("invalid");
  }
  return validateStudioState(next);
}

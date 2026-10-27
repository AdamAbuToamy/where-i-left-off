import type { Change } from "../../assistant/actions";
import type { StudioState } from "../core/model";
import { studioCopy, studioWord } from "./copy";
/** Resolve real record IDs for human previews; never stringify internal control objects. */
export function studioValue(
  value: unknown,
  state: StudioState,
  changes: Change[] = [],
): string {
  if (typeof value === "boolean")
    return studioWord(state.settings.language, value ? "on" : "off");
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value))
    return value.map((item) => studioValue(item, state, changes)).join(" · ");
  if (typeof value === "object")
    return "title" in value
      ? String(value.title)
      : "name" in value
        ? String(value.name)
        : "—";
  if (typeof value === "string") {
    const items = [
      ...state.data.study.courses,
      ...state.data.scopes,
      ...state.data.scopes.flatMap((scope) => scope.sections),
      ...changes.flatMap((change) =>
        change.after
          ? [change.after as { id: string; name?: string; title?: string }]
          : [],
      ),
    ];
    const item = items.find((item) => item.id === value);
    if (item)
      return "name" in item
        ? String(item.name)
        : "title" in item
          ? String(item.title)
          : value;
    if (Object.hasOwn(studioCopy, value))
      return studioWord(
        state.settings.language,
        value as keyof typeof studioCopy,
      );
    if (value === "personal")
      return studioWord(state.settings.language, "projects");
    if (value === "resume") return studioWord(state.settings.language, "today");
  }
  return String(value);
}

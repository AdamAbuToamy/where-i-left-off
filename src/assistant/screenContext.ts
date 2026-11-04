import type { AssistantData } from "./actions";
export type ScreenSelection = {
  page: "personal" | "groups" | "university";
  card?: { scope: string; id: string; name: string };
  course?: { id: string; name: string };
};
/** Resolve view hints against the authorized snapshot. URL text is never a data/permission source. */
export function screenSelection(
  data: AssistantData,
  hash: string,
  expanded: string[] = [],
): ScreenSelection | null {
  const [path, query = ""] = hash.replace(/^#\/?/, "").split("?"),
    parts = path.split("/"),
    page = parts[0];
  if (page === "university") {
    const id = new URLSearchParams(query).get("courseId"),
      course = data.study.courses.find((c) => c.id === id);
    return course
      ? { page, course: { id: course.id, name: course.name } }
      : null;
  }
  if (page !== "personal" && page !== "groups") return null;
  const scope = page === "personal" ? "personal" : parts[1],
    id =
      (page === "personal" ? parts[1] : parts[2]) ||
      (expanded.length === 1 ? expanded[0] : "");
  const card = data.scopes
    .find((s) => s.id === scope)
    ?.projects.find((p) => p.id === id && !p.trashedAt);
  return card ? { page, card: { scope, id: card.id, name: card.name } } : null;
}
export const pilotAssistantCapabilities = [
  {
    id: "work-hub-preview",
    mode: "handoff",
    detail:
      "Administrator preview only. Inbox, daily priorities, card dependencies, work-time blocks, weekly review, course study plans/grades, version restoration, templates/recurrence and named boards are interactive Work hub/board tools. They do not have assistant mutation executors yet. Explain this honestly and direct the user to the matching Work hub tab; never claim to have scheduled a work-time block by changing a card deadline. Existing card/course/task/settings tools remain supported.",
  },
] as const;

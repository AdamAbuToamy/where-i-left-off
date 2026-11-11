import { companionRelease } from "./release";
export type CompanionCategory =
  | "deadlines"
  | "stale"
  | "features"
  | "extension";
export type CompanionPreferences = Record<CompanionCategory, boolean> & {
  enabled: boolean;
  frequency: "gentle" | "normal";
};
export type CompanionItem = {
  kind: "card" | "course" | "task";
  id: string;
  title: string;
  dueAt?: number;
  courseId?: string;
};
export type CompanionState = {
  preferences: CompanionPreferences;
  seen: Record<string, number>;
  visits: Record<string, number>;
  shown: number[];
  pausedUntil: number;
};
export type Suggestion = {
  key: string;
  category: CompanionCategory;
  item?: CompanionItem;
};
export const DAY = 86400000;
export const defaultCompanionPreferences: CompanionPreferences = {
  enabled: true,
  deadlines: true,
  stale: true,
  features: true,
  extension: true,
  frequency: "gentle",
};
export const featureKey = `feature:${companionRelease.id}`;
export const itemKey = (item: Pick<CompanionItem, "kind" | "id">) =>
  `${item.kind}:${item.id}`;
export function selectSuggestion(
  items: readonly CompanionItem[],
  state: CompanionState,
  now: number,
  extensionAvailable: boolean,
): Suggestion | null {
  const p = state.preferences,
    cooldown = p.frequency === "gentle" ? 60 * 60000 : 20 * 60000,
    cap = p.frequency === "gentle" ? 2 : 3;
  if (
    !p.enabled ||
    state.pausedUntil > now ||
    state.shown.some((at) => at > now - cooldown) ||
    state.shown.filter((at) => at > now - DAY).length >= cap
  )
    return null;
  const unseen = (key: string) =>
    !state.seen[key] || now - state.seen[key] >= 7 * DAY;
  if (p.deadlines) {
    const due = items
      .filter(
        (x) =>
          Number.isFinite(x.dueAt) &&
          x.dueAt! > now &&
          x.dueAt! <= now + 3 * DAY,
      )
      .sort((a, b) => a.dueAt! - b.dueAt!);
    for (const item of due) {
      const key = `due:${itemKey(item)}:${item.dueAt}`;
      if (unseen(key)) return { key, category: "deadlines", item };
    }
  }
  if (p.stale) {
    const stale = items
      .filter(
        (x) =>
          x.kind !== "task" &&
          state.visits[itemKey(x)] > 0 &&
          state.visits[itemKey(x)] <= now - 14 * DAY,
      )
      .sort((a, b) => state.visits[itemKey(a)] - state.visits[itemKey(b)]);
    for (const item of stale) {
      const key = `stale:${itemKey(item)}:${state.visits[itemKey(item)]}`;
      if (unseen(key)) return { key, category: "stale", item };
    }
  }
  if (p.features && !state.seen[featureKey])
    return { key: featureKey, category: "features" };
  if (p.extension && extensionAvailable && unseen("extension:chrome"))
    return { key: "extension:chrome", category: "extension" };
  return null;
}
export function companionHref(item: CompanionItem) {
  if (item.kind === "card") return `#/personal/${encodeURIComponent(item.id)}`;
  const query = new URLSearchParams({
    tab: "overview",
    courseId: item.kind === "course" ? item.id : item.courseId || "",
  });
  if (item.kind === "task") query.set("task", item.id);
  return "#/university?" + query.toString();
}

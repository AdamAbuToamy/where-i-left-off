import { useEffect, useState } from "react";
import type { StudioScreen } from "../core/model";
export type StudioRoute = {
  screen: StudioScreen;
  course: string;
  tab: string;
  scope: string;
  item: string;
  term: string;
  query: string;
  library: string;
  filter: string;
  section: string;
  day: string;
  scheduleView: string;
};
export function readStudioRoute(hash = location.hash): StudioRoute {
  const query = new URLSearchParams(hash.split("?")[1] || "");
  const screen = query.get("screen") || "today";
  return {
    screen: [
      "today",
      "projects",
      "university",
      "groups",
      "library",
      "analytics",
      "settings",
    ].includes(screen)
      ? (screen as StudioScreen)
      : "today",
    course: (query.get("course") || "").slice(0, 600),
    tab: query.get("tab") || "overview",
    scope: query.get("scope") || "personal",
    item: query.get("item") || "",
    term: query.get("term") || "current",
    query: (query.get("query") || "").slice(0, 300),
    library: query.get("library") || "archive",
    filter: [
      "all",
      "active",
      "later",
      "waiting",
      "done",
      "overdue",
      "upcoming",
    ].includes(query.get("filter") || "")
      ? query.get("filter")!
      : "all",
    section: (query.get("section") || "all").slice(0, 600),
    day: /^[0-6]$/.test(query.get("day") || "") ? query.get("day")! : "",
    scheduleView: ["agenda", "week"].includes(query.get("scheduleView") || "")
      ? query.get("scheduleView")!
      : "auto",
  };
}
export function navigateStudio(values: Partial<StudioRoute>) {
  const next = { ...readStudioRoute(), ...values },
    query = new URLSearchParams();
  for (const [key, value] of Object.entries(next))
    if (value) query.set(key, value);
  location.hash = "/admin/studio?" + query.toString();
}
export function useStudioRoute() {
  const [route, setRoute] = useState(readStudioRoute);
  useEffect(() => {
    const changed = () => setRoute(readStudioRoute());
    window.addEventListener("hashchange", changed);
    return () => window.removeEventListener("hashchange", changed);
  }, []);
  return route;
}

/** Keep typing immediate while restoring URL searches on browser Back/Forward. */
export function useStudioSearch(): readonly [string, (value: string) => void] {
  const [query, setQuery] = useState(() => readStudioRoute().query);
  useEffect(() => {
    const changed = () => setQuery(readStudioRoute().query);
    window.addEventListener("hashchange", changed);
    return () => window.removeEventListener("hashchange", changed);
  }, []);
  return [
    query,
    (value) => {
      setQuery(value);
      navigateStudio({ query: value });
    },
  ] as const;
}

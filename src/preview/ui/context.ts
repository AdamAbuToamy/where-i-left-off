import { createContext, useContext } from "react";
import type { Action } from "../../assistant/actions";
import type { Course, StudyTask, Lesson } from "../../university/state";
import type { Project, Section } from "../../types";
import type {
  PreviewCommand,
  PreviewJournal,
  PreviewState,
} from "../core/model";
import type { Word } from "./words";
export type Editor =
  | { kind: "course"; value?: Course }
  | { kind: "task"; value?: StudyTask }
  | { kind: "lesson"; value?: Lesson }
  | { kind: "project"; value?: Project }
  | { kind: "section"; value?: Section }
  | { kind: "semester" };
export type Route = {
  screen: "university" | "projects" | "settings";
  course: string;
  tab: "overview" | "tasks" | "materials" | "plan" | "schedule";
  query: string;
  filter: string;
  scope: string;
  term: string;
};
export const defaultRoute: Route = {
  screen: "university",
  course: "",
  tab: "overview",
  query: "",
  filter: "all",
  scope: "personal",
  term: "current",
};
export function readRoute(): Route {
  const p = new URLSearchParams(location.hash.split("?")[1]);
  const screen = p.get("screen") || "",
    tab = p.get("tab") || "";
  return {
    screen: (["university", "projects", "settings"].includes(screen)
      ? screen
      : "university") as Route["screen"],
    tab: (["overview", "tasks", "materials", "plan", "schedule"].includes(tab)
      ? tab
      : "overview") as Route["tab"],
    course: (p.get("course") || "").slice(0, 600),
    scope: (p.get("scope") || "personal").slice(0, 600),
    term: (p.get("term") || "current").slice(0, 100),
    query: (p.get("query") || "").slice(0, 300),
    filter: ["all", "open", "overdue", "done"].includes(p.get("filter") || "")
      ? p.get("filter")!
      : "all",
  };
}
export function go(values: Partial<Route>) {
  const next = { ...readRoute(), ...values };
  location.hash = "/admin/preview?" + new URLSearchParams(next).toString();
}
type Context = {
  state: PreviewState;
  journal: PreviewJournal;
  route: Route;
  now: number;
  busy: boolean;
  reduced: boolean;
  t: (key: Word) => string;
  run: (command: PreviewCommand, revision?: number) => Promise<boolean>;
  act: (actions: Action[]) => Promise<boolean>;
  edit: (value: Editor) => void;
  notify: (text: string) => void;
};
export const PreviewContext = createContext<Context | null>(null);
export function usePreview() {
  const value = useContext(PreviewContext);
  if (!value) throw new Error("preview-context");
  return value;
}

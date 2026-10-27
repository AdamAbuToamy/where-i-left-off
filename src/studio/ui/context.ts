import { createContext, useContext } from "react";
import type { Course, Lesson, StudyTask } from "../../university/state";
import type { Project, Section } from "../../types";
import type { StudioCommand, StudioJournal, StudioState } from "../core/model";
import type { StudioWord } from "./copy";
import type { StudioRoute } from "./navigation";
export type EditorRequest =
  | { kind: "project"; scope: string; value?: Project }
  | { kind: "course"; value?: Course }
  | { kind: "task"; courseId?: string; value?: StudyTask }
  | { kind: "lesson"; courseId?: string; value?: Lesson }
  | { kind: "semester" | "group" }
  | { kind: "section"; scope: string; value?: Section };
export type FocusTarget = { id: string; name: string; startedAt: number };
export type StudioContextValue = {
  uid: string;
  state: StudioState;
  journal: StudioJournal;
  route: StudioRoute;
  now: number;
  busy: boolean;
  t: (key: StudioWord) => string;
  run: (command: StudioCommand, revision?: number) => Promise<boolean>;
  edit: (request: EditorRequest) => void;
  notify: (text: string) => void;
  ask: (prompt?: string) => void;
  focus: (id: string, name: string) => void;
};
export const StudioContext = createContext<StudioContextValue | null>(null);
export function useStudio() {
  const context = useContext(StudioContext);
  if (!context) throw new Error("studio-context");
  return context;
}

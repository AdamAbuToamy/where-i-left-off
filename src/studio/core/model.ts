import type { AssistantData, Change } from "../../assistant/actions";
import type { AssistantControl } from "../../assistant/controlContract";
import type { Language } from "../../translations";
import type { SiteBackground, SiteTheme } from "../../lib/appearanceCatalog";

export type StudioScreen =
  | "today"
  | "projects"
  | "university"
  | "groups"
  | "library"
  | "analytics"
  | "settings";
export type Semester = {
  id: string;
  name: string;
  start: string;
  end: string;
  archived: boolean;
};
export type StudySession = {
  id: string;
  targetId: string;
  name: string;
  seconds: number;
  endedAt: number;
};
export type StudioSettings = {
  displayName: string;
  language: Language;
  mode: "light" | "dark";
  theme: SiteTheme;
  background: SiteBackground;
  enabled: boolean;
  autoArchive: boolean;
  reminders: boolean;
  desktop: boolean;
  reviewDays: number;
  view: "cards" | "list";
};
export type StudioState = {
  version: 1;
  data: AssistantData;
  semesters: Semester[];
  courseSemesters: Record<string, string>;
  reminders: string[];
  sessions: StudySession[];
  settings: StudioSettings;
};
export type StudioJournal = {
  version: 1;
  revision: number;
  current: StudioState;
  undo: StudioState[];
  redo: StudioState[];
  checkpoint: StudioState | null;
};
export type StudioProposal = {
  revision: number;
  changes: Change[];
  controls: AssistantControl[];
};
export type StudioCommand =
  | {
      kind: "actions";
      actions: import("../../assistant/actions").Action[];
      semesterId?: string;
    }
  | { kind: "proposal"; proposal: StudioProposal }
  | { kind: "semester"; value: Semester }
  | { kind: "assign-semester"; courseId: string; semesterId: string }
  | { kind: "settings"; values: Partial<StudioSettings> }
  | { kind: "reminder"; taskId: string }
  | { kind: "session"; value: StudySession }
  | { kind: "group"; id: string; name: string }
  | { kind: "replace"; state: StudioState }
  | { kind: "undo" | "redo" | "checkpoint" | "restore" | "clear-history" };

export interface StudioPersistence {
  read(): StudioJournal | null;
  transact(
    update: (current: StudioJournal | null) => StudioJournal,
  ): Promise<StudioJournal>;
  subscribe(changed: () => void): () => void;
}
export class StudioError extends Error {
  readonly code:
    | "invalid"
    | "conflict"
    | "permission"
    | "missing-checkpoint"
    | "empty-history";
  constructor(code: StudioError["code"]) {
    super("studio-" + code);
    this.code = code;
  }
}

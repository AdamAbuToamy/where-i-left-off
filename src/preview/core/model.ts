import type { AssistantData, Change } from "../../assistant/actions";
import type { AssistantControl } from "../../assistant/controlContract";
import type { Language } from "../../translations";
import type { SiteBackground, SiteTheme } from "../../lib/appearanceCatalog";

export type PreviewScreen =
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
export type PreviewSettings = {
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
export type PreviewState = {
  version: 1;
  data: AssistantData;
  semesters: Semester[];
  courseSemesters: Record<string, string>;
  reminders: string[];
  sessions: StudySession[];
  settings: PreviewSettings;
};
export type PreviewJournal = {
  version: 1;
  revision: number;
  current: PreviewState;
  undo: PreviewState[];
  redo: PreviewState[];
  checkpoint: PreviewState | null;
};
export type PreviewProposal = {
  revision: number;
  changes: Change[];
  controls: AssistantControl[];
};
export type PreviewCommand =
  | {
      kind: "actions";
      actions: import("../../assistant/actions").Action[];
      semesterId?: string;
    }
  | { kind: "proposal"; proposal: PreviewProposal }
  | { kind: "semester"; value: Semester }
  | { kind: "assign-semester"; courseId: string; semesterId: string }
  | { kind: "settings"; values: Partial<PreviewSettings> }
  | { kind: "reminder"; taskId: string }
  | { kind: "session"; value: StudySession }
  | { kind: "group"; id: string; name: string }
  | { kind: "replace"; state: PreviewState }
  | { kind: "undo" | "redo" | "checkpoint" | "restore" | "clear-history" };

export interface PreviewPersistence {
  read(): PreviewJournal | null;
  transact(
    update: (current: PreviewJournal | null) => PreviewJournal,
  ): Promise<PreviewJournal>;
  subscribe(changed: () => void): () => void;
}
export class PreviewError extends Error {
  readonly code:
    | "invalid"
    | "conflict"
    | "permission"
    | "missing-checkpoint"
    | "empty-history";
  constructor(code: PreviewError["code"]) {
    super("preview-" + code);
    this.code = code;
  }
}

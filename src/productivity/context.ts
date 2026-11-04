import { createContext, useContext } from "react";
import type {
  RevisionedRepository,
  JournalView,
} from "../lib/revisionedRepository";
import type {
  OfflineWorkspace,
  OfflineSnapshot,
} from "../lib/offlineWorkspace";
import type { ExperienceState } from "./state";
export type ExperienceContextValue = {
  uid: string;
  workspace: OfflineWorkspace | null;
  cards: OfflineSnapshot | null;
  repository: RevisionedRepository<ExperienceState>;
  view: JournalView<ExperienceState>;
  change: (update: (state: ExperienceState) => ExperienceState) => void;
};
export const ExperienceContext = createContext<ExperienceContextValue | null>(
  null,
);
export const useExperience = () => useContext(ExperienceContext);

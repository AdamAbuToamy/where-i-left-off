import { createContext, useContext } from "react";
import type {
  RevisionedRepository,
  JournalView,
} from "../lib/revisionedRepository";
import type { ExperienceState } from "./state";
export type RelationshipContextValue = {
  uid: string;
  repository: RevisionedRepository<ExperienceState>;
  view: JournalView<ExperienceState>;
  change: (update: (state: ExperienceState) => ExperienceState) => void;
};
export const RelationshipContext =
  createContext<RelationshipContextValue | null>(null);
export const useBoardRelationships = () => useContext(RelationshipContext);

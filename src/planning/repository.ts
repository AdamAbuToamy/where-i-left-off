import { RevisionedRepository } from "../lib/revisionedRepository";
import type {
  JournalRecord,
  JournalPending,
  DocumentJournal,
  JournalLocal,
  JournalRemote,
  JournalView,
  JournalDependencies,
} from "../lib/revisionedRepository";
import { emptyPlanningState, parsePlanningState } from "./domain";
import type { PlanningState } from "./domain";
export { RevisionConflict as BoardConflict } from "../lib/revisionedRepository";
export type BoardRecord = JournalRecord<PlanningState>;
export type PendingBoard = JournalPending<PlanningState>;
export type BoardJournal = DocumentJournal<PlanningState>;
export type BoardLocal = JournalLocal<PlanningState>;
export type BoardRemote = JournalRemote<PlanningState>;
export type BoardView = JournalView<PlanningState>;
export type BoardDependencies = Omit<
  JournalDependencies<PlanningState>,
  "codec"
>;
export class PlanningRepository extends RevisionedRepository<PlanningState> {
  constructor(ports: BoardDependencies) {
    super({
      ...ports,
      codec: {
        errorPrefix: "planning",
        parse: parsePlanningState,
        empty: emptyPlanningState,
      },
    });
  }
}

import { executeStudioCommand } from "./commands";
import { StudioError } from "./model";
import { validateStudioState } from "./validation";
import type {
  StudioCommand,
  StudioJournal,
  StudioPersistence,
  StudioState,
} from "./model";

/** Journal writes are serialized by the persistence port, including cross-tab revision checks. */
export class StudioRepository {
  private readonly persistence: StudioPersistence;
  private readonly seed: () => StudioState;
  private readonly clock: () => number;
  constructor(
    persistence: StudioPersistence,
    seed: () => StudioState,
    clock: () => number,
  ) {
    this.persistence = persistence;
    this.seed = seed;
    this.clock = clock;
  }
  initialize(): Promise<StudioJournal> {
    return this.persistence.transact((stored) => stored ?? this.read());
  }
  read(): StudioJournal {
    return (
      this.persistence.read() ?? {
        version: 1,
        revision: 0,
        current: validateStudioState(this.seed()),
        undo: [],
        redo: [],
        checkpoint: null,
      }
    );
  }
  subscribe(changed: () => void) {
    return this.persistence.subscribe(changed);
  }
  async execute(
    command: StudioCommand,
    expectedRevision: number,
  ): Promise<StudioJournal> {
    return this.persistence.transact((stored) => {
      const journal = stored ?? this.read();
      if (
        journal.revision !== expectedRevision ||
        (command.kind === "proposal" &&
          command.proposal.revision !== journal.revision)
      )
        throw new StudioError("conflict");
      const next = structuredClone(journal);
      if (command.kind === "clear-history") {
        next.undo = [];
        next.redo = [];
      } else if (command.kind === "checkpoint")
        next.checkpoint = structuredClone(journal.current);
      else if (command.kind === "undo" || command.kind === "redo") {
        const from = command.kind === "undo" ? next.undo : next.redo;
        const value = from.pop();
        if (!value) throw new StudioError("empty-history");
        const to = command.kind === "undo" ? next.redo : next.undo;
        to.push(journal.current);
        next.current = value;
      } else {
        const value =
          command.kind === "restore"
            ? journal.checkpoint
            : executeStudioCommand(journal.current, command, this.clock());
        if (!value) throw new StudioError("missing-checkpoint");
        next.undo = [...journal.undo, journal.current].slice(-20);
        next.redo = [];
        next.current = validateStudioState(value);
      }
      next.revision++;
      return next;
    });
  }
}

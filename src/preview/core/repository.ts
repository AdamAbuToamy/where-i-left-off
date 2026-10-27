import { executePreviewCommand } from "./commands";
import { PreviewError } from "./model";
import { validatePreviewState } from "./validation";
import type {
  PreviewCommand,
  PreviewJournal,
  PreviewPersistence,
  PreviewState,
} from "./model";

/** Journal writes are serialized by the persistence port, including cross-tab revision checks. */
export class PreviewRepository {
  private readonly persistence: PreviewPersistence;
  private readonly seed: () => PreviewState;
  private readonly clock: () => number;
  constructor(
    persistence: PreviewPersistence,
    seed: () => PreviewState,
    clock: () => number,
  ) {
    this.persistence = persistence;
    this.seed = seed;
    this.clock = clock;
  }
  initialize(): Promise<PreviewJournal> {
    return this.persistence.transact((stored) => stored ?? this.read());
  }
  read(): PreviewJournal {
    return (
      this.persistence.read() ?? {
        version: 1,
        revision: 0,
        current: validatePreviewState(this.seed()),
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
    command: PreviewCommand,
    expectedRevision: number,
  ): Promise<PreviewJournal> {
    return this.persistence.transact((stored) => {
      const journal = stored ?? this.read();
      if (
        journal.revision !== expectedRevision ||
        (command.kind === "proposal" &&
          command.proposal.revision !== journal.revision)
      )
        throw new PreviewError("conflict");
      const next = structuredClone(journal);
      if (command.kind === "clear-history") {
        next.undo = [];
        next.redo = [];
      } else if (command.kind === "checkpoint")
        next.checkpoint = structuredClone(journal.current);
      else if (command.kind === "undo" || command.kind === "redo") {
        const from = command.kind === "undo" ? next.undo : next.redo;
        const value = from.pop();
        if (!value) throw new PreviewError("empty-history");
        const to = command.kind === "undo" ? next.redo : next.undo;
        to.push(journal.current);
        next.current = value;
      } else {
        const value =
          command.kind === "restore"
            ? journal.checkpoint
            : executePreviewCommand(journal.current, command, this.clock());
        if (!value) throw new PreviewError("missing-checkpoint");
        next.undo = [...journal.undo, journal.current].slice(-20);
        next.redo = [];
        next.current = validatePreviewState(value);
      }
      next.revision++;
      return next;
    });
  }
}

export type JournalCodec<State> = {parse:(value:unknown)=>State;empty:()=>State;errorPrefix?:string};
export class JournalError extends Error {readonly code:string;constructor(code:string){super(code);this.code=code;}}
export type JournalRecord<State> = {
  state: State;
  revision: number;
  mutationId: string;
};
export type JournalPending<State> = {
  state: State;
  expectedRevision: number | null;
  mutationId: string;
};
export type DocumentJournal<State> = {
  version: 1;
  base: JournalRecord<State> | null;
  pending: JournalPending<State> | null;
};
export interface JournalLocal<State> {
  read(): unknown;
  write(journal: DocumentJournal<State>): void;
}
export interface JournalRemote<State> {
  watch(
    receive: (record: JournalRecord<State> | null, fromCache: boolean) => void,
    failed: () => void,
  ): () => void;
  write(
    state: State,
    expectedRevision: number | null,
    mutationId: string,
  ): Promise<JournalRecord<State>>;
}
export class RevisionConflict<State> extends Error {
  readonly current: JournalRecord<State> | null;
  constructor(current: JournalRecord<State> | null) {
    super("journal-conflict");
    this.current = current;
  }
}
export type JournalView<State> = {
  state: State;
  pending: boolean;
  ready: boolean;
  conflict: boolean;
  error: "" | "local" | "remote" | "invalid-local";
  canUndo: boolean;
  canRedo: boolean;
};
export type JournalDependencies<State> = {
  codec: JournalCodec<State>;
  local: JournalLocal<State>;
  remote: JournalRemote<State>;
  isCurrent: () => boolean;
  newId: () => string;
  schedule: (work: () => void) => () => void;
};
function record<State>(value: unknown, codec: JournalCodec<State>): JournalRecord<State> | null {
  if (value === null) return null;
  const r = value as JournalRecord<State>;
  if (
    !r ||
    typeof r !== "object" ||
    !Number.isInteger(r.revision) ||
    r.revision < 1 ||
    r.revision > 10000000 ||
    typeof r.mutationId !== "string" ||
    !/^[-\w]{1,100}$/.test(r.mutationId)
  )
    throw new JournalError(`${codec.errorPrefix || "journal"}-invalid`);
  return {
    state: codec.parse(r.state),
    revision: r.revision,
    mutationId: r.mutationId,
  };
}
function journal<State>(value: unknown, codec: JournalCodec<State>): DocumentJournal<State> {
  if (value == null) return { version: 1, base: null, pending: null };
  const raw = value as DocumentJournal<State>;
  if (!raw || typeof raw !== "object" || raw.version !== 1)
    throw new JournalError(`${codec.errorPrefix || "journal"}-invalid`);
  const base = record(raw.base, codec);
  let pending: JournalPending<State> | null = null;
  if (raw.pending !== null) {
    const p = raw.pending;
    if (
      !p ||
      (p.expectedRevision !== null &&
        (!Number.isInteger(p.expectedRevision) ||
          p.expectedRevision < 1 ||
          p.expectedRevision > 10000000)) ||
      typeof p.mutationId !== "string" ||
      !/^[-\w]{1,100}$/.test(p.mutationId)
    )
      throw new JournalError(`${codec.errorPrefix || "journal"}-invalid`);
    pending = {
      state: codec.parse(p.state),
      expectedRevision: p.expectedRevision,
      mutationId: p.mutationId,
    };
  }
  return { version: 1, base, pending };
}
/** One atomic, revision-checked canvas snapshot. No collaborator can write project records. */
export class RevisionedRepository<State> {
  private base: JournalRecord<State> | null = null;
  private pending: JournalPending<State> | null = null;
  private remoteValue: JournalRecord<State> | null = null;
  private inflight: JournalPending<State> | null = null;
  private active = false;
  private ready = false;
  private conflict = false;
  private error: JournalView<State>["error"] = "";
  private invalid = false;
  private notify: (view: JournalView<State>) => void = () => {};
  private stopWatch = () => {};
  private cancel = () => {};
  private undos: State[] = [];
  private redos: State[] = [];
  private historyGroup = "";
  private readonly ports: JournalDependencies<State>;
  constructor(ports: JournalDependencies<State>) {
    this.ports = ports;
    try {
      const stored = journal(ports.local.read(), ports.codec);
      this.base = stored.base;
      this.pending = stored.pending;
    } catch {
      this.invalid = true;
      this.error = "invalid-local";
    }
  }
  get state() {
    return this.pending?.state || this.base?.state || this.ports.codec.empty();
  }
  get view(): JournalView<State> {
    return {
      state: this.state,
      pending: !!this.pending,
      ready: this.ready,
      conflict: this.conflict,
      error: this.error,
      canUndo: this.undos.length > 0,
      canRedo: this.redos.length > 0,
    };
  }
  start(notify: (view: JournalView<State>) => void) {
    if (this.active) throw new JournalError(`${this.ports.codec.errorPrefix || "journal"}-account`);
    this.active = true;
    this.notify = notify;
    this.publish();
    if (!this.invalid) this.watch();
    return () => this.stop();
  }
  stop() {
    this.cancel();
    if (this.pending && this.ready && !this.conflict) void this.flush();
    this.active = false;
    this.stopWatch();
  }
  private watch() {
    this.stopWatch();
    this.stopWatch = this.ports.remote.watch(
      (incoming, cached) => this.receive(incoming, cached),
      () => {
        this.ready = false;
        this.error = "remote";
        this.publish();
      },
    );
  }
  private publish() {
    if (this.active && this.ports.isCurrent()) this.notify(this.view);
  }
  private persist(base = this.base, pending = this.pending) {
    this.ports.local.write({ version: 1, base, pending });
  }
  private remember() {
    try {
      this.persist();
    } catch {
      this.error = "local";
    }
  }
  private receive(incoming: JournalRecord<State> | null, cached: boolean) {
    if (!this.active || !this.ports.isCurrent()) return;
    if (cached) {
      if (!this.pending && !this.base) this.base = incoming;
      this.publish();
      return;
    }
    this.ready = true;
    this.remoteValue = incoming;
    if (this.error === "remote") this.error = "";
    if (
      incoming &&
      (incoming.mutationId === this.pending?.mutationId ||
        incoming.mutationId === this.inflight?.mutationId)
    ) {
      if (incoming.mutationId === this.pending?.mutationId) this.pending = null;
      else if (this.pending)
        this.pending = { ...this.pending, expectedRevision: incoming.revision };
      this.base = incoming;
    } else if (!this.pending) {
      if (
        incoming?.mutationId !== this.base?.mutationId ||
        incoming?.revision !== this.base?.revision
      ) {
        this.undos = [];
        this.redos = [];
        this.historyGroup = "";
      }
      this.base = incoming;
    } else if ((incoming?.revision ?? null) !== this.pending.expectedRevision)
      this.conflict = true;
    else this.base = incoming;
    this.remember();
    this.publish();
    this.queue();
  }
  apply(next: State, historyGroup = "", trackHistory = true) {
    if (!this.active || !this.ports.isCurrent())
      throw new JournalError(`${this.ports.codec.errorPrefix || "journal"}-account`);
    if (this.invalid) throw new JournalError(`${this.ports.codec.errorPrefix || "journal"}-local`);
    const parsed = this.ports.codec.parse(next),
      previous = this.state;
    if (JSON.stringify(parsed) === JSON.stringify(previous)) return;
    const pending: JournalPending<State> = {
      state: parsed,
      expectedRevision: this.inflight
        ? (this.inflight.expectedRevision ?? 0) + 1
        : (this.pending?.expectedRevision ?? this.base?.revision ?? null),
      mutationId: this.ports.newId(),
    };
    // Cache atomically before claiming that the edit was accepted.
    try {
      this.persist(this.base, pending);
    } catch {
      this.error = "local";
      this.publish();
      throw new JournalError(`${this.ports.codec.errorPrefix || "journal"}-local`);
    }
    if (trackHistory) {
      if (!historyGroup || historyGroup !== this.historyGroup)
        this.undos = [...this.undos.slice(-29), previous];
      this.redos = [];
      this.historyGroup = historyGroup;
    }
    this.pending = pending;
    this.error = "";
    this.publish();
    this.queue();
  }
  undo() {
    const previous = this.undos.at(-1);
    if (!previous) return;
    const current = this.state;
    this.apply(previous, "", false);
    this.undos.pop();
    this.redos.push(current);
    this.historyGroup = "";
    this.publish();
  }
  redo() {
    const next = this.redos.at(-1);
    if (!next) return;
    const current = this.state;
    this.apply(next, "", false);
    this.redos.pop();
    this.undos.push(current);
    this.historyGroup = "";
    this.publish();
  }
  resolve(choice: "local" | "remote") {
    if (!this.conflict || !this.ports.isCurrent()) return;
    const nextBase = this.remoteValue;
    const nextPending =
      choice === "remote"
        ? null
        : this.pending
          ? {
              ...this.pending,
              expectedRevision: nextBase?.revision ?? null,
              mutationId: this.ports.newId(),
            }
          : null;
    try {
      this.persist(nextBase, nextPending);
    } catch {
      this.error = "local";
      this.publish();
      throw new JournalError(`${this.ports.codec.errorPrefix || "journal"}-local`);
    }
    this.base = nextBase;
    this.pending = nextPending;
    if (choice === "remote") {
      this.undos = [];
      this.redos = [];
    }
    this.conflict = false;
    this.error = "";
    this.publish();
    this.queue();
  }
  retry() {
    if (this.invalid || !this.active || !this.ports.isCurrent()) return;
    this.error = "";
    this.ready = false;
    this.watch();
    this.publish();
  }
  private queue() {
    this.cancel();
    if (
      this.pending &&
      this.active &&
      this.ready &&
      !this.conflict &&
      !this.error
    )
      this.cancel = this.ports.schedule(() => {
        void this.flush();
      });
  }
  async flush() {
    if (
      this.inflight ||
      !this.pending ||
      !this.ready ||
      this.conflict ||
      this.invalid ||
      !this.ports.isCurrent()
    )
      return;
    const sent = this.pending;
    this.inflight = sent;
    try {
      const saved = await this.ports.remote.write(
        sent.state,
        sent.expectedRevision,
        sent.mutationId,
      );
      if (!this.ports.isCurrent()) return;
      this.base = saved;
      this.remoteValue = saved;
      if (this.pending?.mutationId === sent.mutationId) this.pending = null;
      else if (this.pending)
        this.pending = { ...this.pending, expectedRevision: saved.revision };
      this.error = "";
      this.remember();
    } catch (error) {
      if (!this.ports.isCurrent()) return;
      if (error instanceof RevisionConflict) {
        this.remoteValue = record(error.current, this.ports.codec);
        this.conflict = true;
      } else this.error = "remote";
    } finally {
      this.inflight = null;
      this.publish();
      this.queue();
      if (
        !this.active &&
        this.pending &&
        !this.error &&
        !this.conflict &&
        this.ports.isCurrent()
      )
        void this.flush();
    }
  }
}

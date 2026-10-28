import {
  emptySession,
  parseSession,
  planSessionOperations,
  SessionError,
} from "./domain";
import type { SessionIdentity, SessionState, SessionProposal } from "./domain";
export type RemoteSession = {
  state: SessionState;
  revision: number;
  mutationId: string;
};
export type SessionJournal = {
  state: SessionState;
  remoteRevision: number | null;
  pending: boolean;
  conflict?: RemoteSession | null;
  hasConflict?: boolean;
};
export class SessionRemoteConflict extends SessionError {
  readonly remote: RemoteSession | null;
  constructor(remote: RemoteSession | null) {
    super("session-conflict");
    this.remote = remote;
  }
}
export type SessionStatus = {
  ready: boolean;
  pending: boolean;
  conflict: boolean;
  error: string;
};
export interface SessionLocalPort {
  read(): Promise<SessionJournal | null>;
  update(
    change: (current: SessionJournal | null) => SessionJournal,
  ): Promise<SessionJournal>;
  listen(changed: () => void): () => void;
  sync<T>(work: () => Promise<T>): Promise<T>;
}
export interface SessionRemotePort {
  watch(
    receive: (value: RemoteSession | null, fromCache: boolean) => void,
    failed: (error: unknown) => void,
  ): () => void;
  write(
    state: SessionState,
    expectedRevision: number | null,
    mutationId: string,
  ): Promise<RemoteSession>;
}
export type SessionRepositoryOptions = {
  identity: SessionIdentity;
  local: SessionLocalPort;
  remote: SessionRemotePort;
  authorized: () => boolean;
  online: () => boolean;
  newId: () => string;
  now: () => number;
};
const code = (error: unknown) =>
  error instanceof Error ? error.message : "session-save-failed";
/** One private session, one local journal, one CAS server document. UI/models never write. */
export class SessionRepository {
  private readonly options: SessionRepositoryOptions;
  private journal: SessionJournal;
  private ready = false;
  private error = "";
  private stopped = false;
  private lifecycle = 0;
  private serial: Promise<unknown> = Promise.resolve();
  private stopRemote = () => {};
  private stopLocal = () => {};
  private listener:
    | ((state: SessionState, status: SessionStatus) => void)
    | null = null;
  constructor(options: SessionRepositoryOptions) {
    this.options = options;
    this.journal = {
      state: emptySession(options.identity),
      remoteRevision: null,
      pending: false,
    };
  }
  private check() {
    if (this.stopped || !this.options.authorized())
      throw new SessionError("account-changed");
  }
  private enqueue<T>(work: () => Promise<T>): Promise<T> {
    const next = this.serial.then(() => {
      this.check();
      return work();
    });
    this.serial = next.catch(() => {});
    return next;
  }
  private validate(journal: SessionJournal) {
    parseSession(journal.state, this.options.identity);
    return journal;
  }
  private emit() {
    if (!this.stopped)
      this.listener?.(structuredClone(this.journal.state), {
        ready: this.ready,
        pending: this.journal.pending,
        conflict: !!this.journal.hasConflict,
        error: this.error,
      });
  }
  current() {
    this.check();
    return structuredClone(this.journal.state);
  }
  status(): SessionStatus {
    return {
      ready: this.ready,
      pending: this.journal.pending,
      conflict: !!this.journal.hasConflict,
      error: this.error,
    };
  }
  async start(listener: (state: SessionState, status: SessionStatus) => void) {
    const lifecycle = ++this.lifecycle;
    this.stopped = false;
    this.listener = listener;
    const local = await this.options.local.read();
    if (lifecycle !== this.lifecycle) return;
    this.check();
    if (local) this.journal = this.validate(local);
    this.ready = !!local || !this.options.online();
    this.emit();
    this.stopLocal = this.options.local.listen(() => {
      if (lifecycle !== this.lifecycle) return;
      void this.enqueue(async () => {
        const latest = await this.options.local.read();
        if (latest) this.journal = this.validate(latest);
        this.emit();
      }).catch((error) => this.failed(error));
    });
    this.stopRemote = this.options.remote.watch(
      (value, fromCache) => {
        if (lifecycle !== this.lifecycle) return;
        if (fromCache && !value) return;
        void this.enqueue(async () => {
          if (value) parseSession(value.state, this.options.identity);
          this.journal = await this.options.local.update((current) => {
            const cached = current ? this.validate(current) : this.journal;
            if (cached.pending) {
              if (
                !fromCache &&
                (value?.revision ?? null) !== cached.remoteRevision
              ) {
                if (
                  value &&
                  JSON.stringify(value.state) === JSON.stringify(cached.state)
                )
                  return {
                    state: cached.state,
                    remoteRevision: value.revision,
                    pending: false,
                  };
                return { ...cached, hasConflict: true, conflict: value };
              }
              return cached;
            }
            return value
              ? {
                  state: value.state,
                  remoteRevision: value.revision,
                  pending: false,
                }
              : cached;
          });
          this.check();
          this.ready = true;
          this.emit();
        })
          .then(() => {
            if (this.journal.pending && !this.journal.hasConflict)
              void this.flush();
          })
          .catch((error) => this.failed(error));
      },
      (error) => {
        if (lifecycle !== this.lifecycle) return;
        this.ready = true;
        this.failed(error);
      },
    );
    if (this.journal.pending) void this.flush();
  }
  private failed(error: unknown) {
    if (!this.stopped) {
      this.error = code(error);
      this.emit();
    }
  }
  async apply(
    proposal: SessionProposal,
  ): Promise<{ state: SessionState; pending: boolean }> {
    return this.enqueue(async () => {
      if (!this.ready) throw new SessionError("session-not-ready");
      this.journal = await this.options.local.update((current) => {
        this.check();
        const journal = current ? this.validate(current) : this.journal;
        if (journal.hasConflict) throw new SessionError("session-conflict");
        const next = planSessionOperations(
          journal.state,
          proposal,
          this.options.now(),
        );
        return {
          ...journal,
          state: next,
          pending: journal.pending || next.revision !== journal.state.revision,
        };
      });
      this.check();
      this.error = "";
      this.emit();
      if (this.journal.pending) queueMicrotask(() => void this.flush());
      return {
        state: structuredClone(this.journal.state),
        pending: this.journal.pending,
      };
    });
  }
  async flush(): Promise<void> {
    if (this.stopped || !this.options.online()) return;
    return this.enqueue(() =>
      this.options.local.sync(async () => {
        const latest = await this.options.local.read();
        if (latest) this.journal = this.validate(latest);
        const sent = structuredClone(this.journal);
        if (!sent.pending || sent.hasConflict) return;
        try {
          const result = await this.options.remote.write(
            sent.state,
            sent.remoteRevision,
            this.options.newId(),
          );
          this.check();
          this.journal = await this.options.local.update((current) => {
            const cached = current ? this.validate(current) : sent;
            const prefix = sent.state.applied.every(
              (id, index) => cached.state.applied[index] === id,
            );
            if (!prefix)
              return { ...cached, hasConflict: true, conflict: result };
            return {
              state: cached.state,
              remoteRevision: result.revision,
              pending: cached.state.revision !== sent.state.revision,
            };
          });
          this.ready = true;
          this.error = "";
          this.emit();
          if (this.journal.pending) queueMicrotask(() => void this.flush());
        } catch (error) {
          if (error instanceof SessionRemoteConflict)
            this.journal = await this.options.local.update((current) => ({
              ...(current || this.journal),
              hasConflict: true,
              conflict: error.remote,
            }));
          this.failed(error);
        }
      }),
    ).catch((error) => this.failed(error));
  }
  async resolve(choice: "local" | "remote"): Promise<void> {
    await this.enqueue(async () => {
      if (!this.journal.hasConflict) throw new SessionError("session-conflict");
      this.journal = await this.options.local.update((current) => {
        const cached = current ? this.validate(current) : this.journal,
          remote = cached.conflict;
        if (!cached.hasConflict) throw new SessionError("session-conflict");
        if (choice === "remote")
          return {
            state: remote?.state || emptySession(this.options.identity),
            remoteRevision: remote?.revision ?? null,
            pending: false,
          };
        return {
          state: cached.state,
          remoteRevision: remote?.revision ?? null,
          pending: true,
        };
      });
      this.error = "";
      this.emit();
    });
    if (choice === "local") void this.flush();
  }
  stop() {
    this.lifecycle++;
    this.stopped = true;
    this.stopRemote();
    this.stopLocal();
    this.listener = null;
  }
}

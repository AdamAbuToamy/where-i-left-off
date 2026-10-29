import {
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import type { Firestore, DocumentData } from "firebase/firestore";
import { parseSession, SessionError } from "./domain";
import type { SessionIdentity, SessionState } from "./domain";
import { SessionRemoteConflict } from "./repository";
import type { RemoteSession, SessionRemotePort } from "./repository";
/** Keep provider details at this boundary; expose stable codes without account content. */
function sessionRemoteError(error: unknown): SessionError {
  if (error instanceof SessionError) return error;
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code).replace(/^firestore\//, "")
      : "";
  const known = [
    "permission-denied",
    "unauthenticated",
    "unavailable",
    "deadline-exceeded",
    "resource-exhausted",
    "failed-precondition",
    "aborted",
  ];
  const failure = new SessionError(
    known.includes(code) ? code : "session-save-failed",
  );
  Object.defineProperty(failure, "cause", { value: error });
  return failure;
}
export class FirestoreSessionRemote implements SessionRemotePort {
  private readonly db: Firestore;
  private readonly uid: string;
  private readonly identity: SessionIdentity;
  private readonly authorized: () => boolean;
  constructor(
    db: Firestore,
    uid: string,
    identity: SessionIdentity,
    authorized: () => boolean,
  ) {
    this.db = db;
    this.uid = uid;
    this.identity = identity;
    this.authorized = authorized;
  }
  private check() {
    if (!this.authorized()) throw new SessionError("account-changed");
  }
  private ref() {
    return doc(
      this.db,
      "users",
      this.uid,
      "sessionWorkspaces",
      this.identity.id,
    );
  }
  private decode(value: DocumentData): RemoteSession {
    if (
      !Number.isSafeInteger(value.revision) ||
      value.revision < 0 ||
      typeof value.payload !== "string" ||
      typeof value.mutationId !== "string"
    )
      throw new SessionError("session-invalid");
    return {
      state: parseSession(JSON.parse(value.payload), this.identity),
      revision: value.revision,
      mutationId: value.mutationId,
    };
  }
  watch(
    receive: (value: RemoteSession | null, fromCache: boolean) => void,
    failed: (error: unknown) => void,
  ) {
    this.check();
    return onSnapshot(
      this.ref(),
      { includeMetadataChanges: true },
      (snapshot) => {
        try {
          this.check();
          receive(
            snapshot.exists() ? this.decode(snapshot.data()) : null,
            snapshot.metadata.fromCache,
          );
        } catch (error) {
          failed(sessionRemoteError(error));
        }
      },
      (error) => failed(sessionRemoteError(error)),
    );
  }
  async write(
    state: SessionState,
    expectedRevision: number | null,
    mutationId: string,
  ) {
    try {
      this.check();
      const clean = parseSession(state, this.identity),
        ref = this.ref();
      await runTransaction(this.db, async (tx) => {
        this.check();
        const snapshot = await tx.get(ref);
        this.check();
        const current = snapshot.exists() ? this.decode(snapshot.data()) : null;
        if ((current?.revision ?? null) !== expectedRevision)
          throw new SessionRemoteConflict(current);
        tx.set(ref, {
          projectId: clean.projectId,
          groupId: clean.groupId,
          startedAt: clean.startedAt,
          payload: JSON.stringify(clean),
          revision: (expectedRevision ?? -1) + 1,
          mutationId,
          updatedAt: serverTimestamp(),
        });
      });
      this.check();
      // Resolving runTransaction is the server commit acknowledgement. A second read can
      // fail after a successful save, or observe another device's later revision.
      return {
        state: clean,
        revision: (expectedRevision ?? -1) + 1,
        mutationId,
      };
    } catch (error) {
      throw sessionRemoteError(error);
    }
  }
}

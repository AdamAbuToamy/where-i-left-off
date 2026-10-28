import { auth, db } from "../lib/firebase";
import { createClientId } from "../lib/clientId";
import { BrowserSessionStore } from "./browserStore";
import { FirestoreSessionRemote } from "./firestoreRemote";
import { SessionRepository } from "./repository";
import type { SessionIdentity } from "./domain";
import type { SessionRemotePort } from "./repository";
export const activeSessionWorkspaces = new Set<string>();
export function createSessionWorkspace(uid: string, identity: SessionIdentity) {
  const authorized = () => auth?.currentUser?.uid === uid;
  const unavailable: SessionRemotePort = {
    watch: (_receive, failed) => {
      queueMicrotask(() => failed(new Error("session-unavailable")));
      return () => {};
    },
    write: () => Promise.reject(new Error("session-unavailable")),
  };
  return new SessionRepository({
    identity,
    local: new BrowserSessionStore(
      db?.app.options.projectId || "unconfigured",
      uid,
      identity,
    ),
    remote: db
      ? new FirestoreSessionRemote(db, uid, identity, authorized)
      : unavailable,
    authorized,
    online: () => navigator.onLine,
    newId: createClientId,
    now: Date.now,
  });
}

import { parseSession } from "./domain";
import type { SessionIdentity } from "./domain";
import type { SessionJournal, SessionLocalPort } from "./repository";
let database: Promise<IDBDatabase> | undefined;
const syncing = new Map<string, Promise<unknown>>();
function open() {
  if (!database)
    database = new Promise((resolve, reject) => {
      const request = indexedDB.open("wilo-session-workspaces", 1);
      request.onupgradeneeded = () => {
        const store = request.result.createObjectStore("sessions");
        store.createIndex("pendingAccount", "accountPending");
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error("local-storage-unavailable"));
      request.onblocked = () => reject(new Error("local-storage-unavailable"));
    });
  return database;
}
/** Atomic local edits across tabs. Only namespaced keys are broadcast, never speech. */
export class BrowserSessionStore implements SessionLocalPort {
  private readonly key: string;
  private readonly accountKey: string;
  private readonly identity: SessionIdentity;
  constructor(project: string, uid: string, identity: SessionIdentity) {
    this.accountKey = project + "/" + uid;
    this.key = this.accountKey + "/" + identity.id;
    this.identity = identity;
  }
  private validate(value: SessionJournal | null): SessionJournal | null {
    if (value) parseSession(value.state, this.identity);
    return value;
  }
  async read(): Promise<SessionJournal | null> {
    const db = await open();
    return new Promise((resolve, reject) => {
      const request = db
        .transaction("sessions", "readonly")
        .objectStore("sessions")
        .get(this.key);
      request.onsuccess = () => {
        try {
          resolve(this.validate(request.result || null));
        } catch (error) {
          reject(error);
        }
      };
      request.onerror = () => reject(new Error("local-storage-unavailable"));
    });
  }
  async update(
    change: (current: SessionJournal | null) => SessionJournal,
  ): Promise<SessionJournal> {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("sessions", "readwrite"),
        store = tx.objectStore("sessions"),
        request = store.get(this.key);
      let next: SessionJournal;
      request.onsuccess = () => {
        try {
          next = change(this.validate(request.result || null));
          this.validate(next);
          store.put(
            {
              ...next,
              accountPending:
                next.pending && !next.hasConflict ? this.accountKey : "",
            },
            this.key,
          );
        } catch (error) {
          tx.abort();
          reject(error);
        }
      };
      tx.oncomplete = () => {
        window.dispatchEvent(
          new CustomEvent("wilo-session-local", { detail: this.key }),
        );
        const channel =
          typeof BroadcastChannel === "undefined"
            ? null
            : new BroadcastChannel("wilo-session-local");
        channel?.postMessage(this.key);
        channel?.close();
        resolve(next);
      };
      tx.onerror = () => reject(new Error("local-storage-unavailable"));
      tx.onabort = () => reject(new Error("local-storage-unavailable"));
    });
  }
  async sync<T>(work: () => Promise<T>): Promise<T> {
    if (navigator.locks)
      return navigator.locks.request("wilo-session-sync:" + this.key, work);
    const previous = syncing.get(this.key) || Promise.resolve(),
      next = previous.catch(() => {}).then(work);
    syncing.set(this.key, next);
    try {
      return await next;
    } finally {
      if (syncing.get(this.key) === next) syncing.delete(this.key);
    }
  }
  static async clearAccount(project: string, uid: string) {
    const db = await open(),
      prefix = project + "/" + uid + "/";
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("sessions", "readwrite");
      tx.objectStore("sessions").delete(
        IDBKeyRange.bound(prefix, prefix + "\uffff"),
      );
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(new Error("local-storage-unavailable"));
    });
  }
  static async pending(
    project: string,
    uid: string,
  ): Promise<SessionJournal[]> {
    const db = await open();
    return new Promise((resolve, reject) => {
      const request = db
        .transaction("sessions", "readonly")
        .objectStore("sessions")
        .index("pendingAccount")
        .getAll(IDBKeyRange.only(project + "/" + uid), 20);
      request.onsuccess = () => resolve(request.result as SessionJournal[]);
      request.onerror = () => reject(new Error("local-storage-unavailable"));
    });
  }
  listen(changed: () => void) {
    const receive = (event: Event) => {
        if ((event as CustomEvent).detail === this.key) changed();
      },
      channel =
        typeof BroadcastChannel === "undefined"
          ? null
          : new BroadcastChannel("wilo-session-local");
    window.addEventListener("wilo-session-local", receive);
    if (channel)
      channel.onmessage = (event) => {
        if (event.data === this.key) changed();
      };
    return () => {
      window.removeEventListener("wilo-session-local", receive);
      channel?.close();
    };
  }
}

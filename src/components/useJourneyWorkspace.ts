import { useEffect, useRef, useState } from "react";
import { auth, db } from "../lib/firebase";
import { createWorkspace } from "../lib/createWorkspace";
import type {
  OfflineSnapshot,
  OfflineWorkspace,
} from "../lib/offlineWorkspace";
/** UI composition boundary. Reuses the same revisioned/offline repository as the cards page. */
export function useJourneyWorkspace(uid: string, active: boolean) {
  const [snapshot, setSnapshot] = useState<OfflineSnapshot | null>(null);
  const latest = useRef<OfflineSnapshot | null>(null),
    repository = useRef<OfflineWorkspace | null>(null);
  useEffect(() => {
    if (!active || !db) return;
    const workspace = createWorkspace(
      db,
      uid,
      () => auth?.currentUser?.uid === uid,
      (state) => {
        latest.current = state;
        setSnapshot(state);
      },
    );
    repository.current = workspace;
    const stop = workspace.start();
    return () => {
      stop();
      repository.current = null;
      latest.current = null;
    };
  }, [uid, active]);
  const ready =
    !!snapshot &&
    !snapshot.cached &&
    !snapshot.error &&
    !snapshot.conflicts.length &&
    snapshot.queued === 0;
  async function discard(ids: readonly string[]) {
    const workspace = repository.current,
      state = latest.current;
    if (
      !workspace ||
      !state ||
      state.cached ||
      state.error ||
      state.conflicts.length ||
      state.queued ||
      !navigator.onLine ||
      auth?.currentUser?.uid !== uid
    )
      throw new Error("tour-cleanup-not-ready");
    // Exact creation receipts only: never title-matching, account-wide clearing or group mutations.
    for (const id of new Set(ids)) {
      const current = latest.current?.projects.find(
        (project) => project.id === id,
      );
      if (current) await workspace.change(current, "delete");
    }
    await workspace.flush();
    const end = Date.now() + 20000;
    for (;;) {
      if (auth?.currentUser?.uid !== uid || !repository.current)
        throw new Error("account-changed");
      const next = latest.current;
      if (next?.error || next?.conflicts.length)
        throw new Error("tour-cleanup-conflict");
      if (
        next &&
        next.queued === 0 &&
        !next.syncing &&
        !next.cached &&
        ids.every((id) => !next.projects.some((project) => project.id === id))
      )
        return;
      if (Date.now() > end) throw new Error("tour-cleanup-pending");
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  return { snapshot, ready, discard };
}

import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { UniversityStore } from "./store";
import {
  universityReminderProjectIds,
  universityReminderProjectIdsFromRecords,
} from "../../shared/universityCardVisibility.mjs";
const emptyIds = new Set<string>();
type Index = { uid: string; ids: Set<string>; ready: boolean; failed: boolean };
/** Presentation-only index. Never removes backing documents or changes scheduling. */
export function useUniversityReminderLinks(user: User, enabled = true) {
  const [index, setIndex] = useState<Index>({
    uid: "",
    ids: new Set(),
    ready: false,
    failed: false,
  });
  useEffect(() => {
    if (!enabled || !user.emailVerified || !db) return;
    const uid = user.uid;
    let alive = true;
    const current = () => alive && auth?.currentUser?.uid === uid;
    const local = (includeStoredTasks = true) => {
      try {
        const store = new UniversityStore(
          uid,
          db!.app.options.projectId || "local",
        );
        if (includeStoredTasks)
          return universityReminderProjectIds(store.load().tasks);
        const journal = store.loadSync() as {
          pending?: [
            string,
            {
              record: {
                kind?: string;
                id?: string;
                deleted?: boolean;
                payload?: string;
              };
            },
          ][];
        } | null;
        return universityReminderProjectIdsFromRecords(
          (journal?.pending || []).map(([, change]) => change.record),
        );
      } catch {
        return new Set<string>();
      }
    };
    const stop = onSnapshot(
      query(
        collection(db, "users", uid, "studyRecords"),
        where("kind", "==", "tasks"),
      ),
      { includeMetadataChanges: true },
      (snapshot) => {
        if (!current()) return;
        const ids = universityReminderProjectIdsFromRecords(
          snapshot.docs.map((doc) => doc.data()),
        );
        // A partial offline Firestore cache must not discard links from the university journal.
        for (const id of local(snapshot.metadata.fromCache)) ids.add(id);
        setIndex({ uid, ids, ready: true, failed: false });
      },
      () => {
        if (current())
          setIndex({ uid, ids: local(), ready: false, failed: true });
      },
    );
    return () => {
      alive = false;
      stop();
    };
  }, [user.uid, user.emailVerified, enabled]);
  if (!enabled || !user.emailVerified || !db)
    return { ids: emptyIds, ready: true, failed: false };
  return index.uid === user.uid
    ? index
    : { ids: emptyIds, ready: false, failed: false };
}

import {
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { createClientId } from "../lib/clientId";
import { parsePlanningState, PlanningError } from "./domain";
import { BoardConflict, PlanningRepository } from "./repository";
import type { BoardRecord } from "./repository";
function decode(value: Record<string, unknown>): BoardRecord {
  if (
    value.version !== 1 ||
    typeof value.payload !== "string" ||
    value.payload.length > 150000 ||
    !Number.isInteger(value.revision) ||
    Number(value.revision) < 1 ||
    Number(value.revision) > 10000000 ||
    typeof value.mutationId !== "string" ||
    !/^[-\w]{1,100}$/.test(value.mutationId)
  )
    throw new PlanningError("planning-invalid");
  try {
    return {
      state: parsePlanningState(JSON.parse(value.payload)),
      revision: Number(value.revision),
      mutationId: value.mutationId,
    };
  } catch {
    throw new PlanningError("planning-invalid");
  }
}
/** Concrete browser/Firestore composition. No board adapter receives a project write path. */
export function createPlanningRepository(uid: string, scope: string) {
  if (scope && !/^[A-Za-z0-9]{20}$/.test(scope))
    throw new PlanningError("planning-invalid");
  const isCurrent = () => auth?.currentUser?.uid === uid;
  const check = () => {
    if (!isCurrent()) throw new PlanningError("planning-account");
  };
  const boardId = scope ? "group_" + scope : "personal",
    key = `planning-board:v1/${db!.app.options.projectId}/${uid}/${boardId}`;
  const reference = doc(db!, "users", uid, "planningBoards", boardId);
  return new PlanningRepository({
    isCurrent,
    newId: createClientId,
    schedule(work) {
      const timer = setTimeout(work, 450);
      return () => clearTimeout(timer);
    },
    local: {
      read() {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
      },
      write(journal) {
        localStorage.setItem(key, JSON.stringify(journal));
      },
    },
    remote: {
      watch(receive, failed) {
        check();
        return onSnapshot(
          reference,
          { includeMetadataChanges: true },
          (snapshot) => {
            try {
              check();
              receive(
                snapshot.exists() ? decode(snapshot.data()) : null,
                snapshot.metadata.fromCache ||
                  snapshot.metadata.hasPendingWrites,
              );
            } catch {
              failed();
            }
          },
          () => failed(),
        );
      },
      async write(state, expectedRevision, mutationId) {
        check();
        const payload = JSON.stringify(parsePlanningState(state));
        return runTransaction(db!, async (transaction) => {
          check();
          const snapshot = await transaction.get(reference),
            current = snapshot.exists() ? decode(snapshot.data()) : null;
          if (current?.mutationId === mutationId) return current;
          if ((current?.revision ?? null) !== expectedRevision)
            throw new BoardConflict(current);
          const revision = (current?.revision ?? 0) + 1;
          transaction.set(reference, {
            version: 1,
            scope,
            payload,
            revision,
            mutationId,
            updatedAt: serverTimestamp(),
          });
          return { state, revision, mutationId };
        });
      },
    },
  });
}

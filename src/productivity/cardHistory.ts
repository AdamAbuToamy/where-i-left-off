import { auth } from "../lib/firebase";
import { isAdmin } from "../lib/admin";
import type { Project } from "../types";
import { ProjectEntity } from "../lib/projectEntity";
export type StoredCardVersion = {
  mutationId: string;
  revision: number;
  at: number;
  actorId: string;
  actorName: string;
  source: "workspace" | "assistant" | "legacy";
  payload: string;
};
/** History is written in the project document itself: one revision/atomic write, no extra rule reads. */
export function cardHistoryFields(
  raw: Record<string, unknown> | undefined,
  before: Project | null,
  mutationId: string,
  revision: number,
  source: "workspace" | "assistant",
  uid: string,
) {
  const user = auth?.currentUser,
    previous = raw?.versionHistory as
      | {
          entries?: StoredCardVersion[];
          revision?: number;
          actorId?: string;
          actorName?: string;
          source?: StoredCardVersion["source"];
        }
      | undefined;
  if (user?.uid !== uid || !isAdmin(user.email, user.emailVerified))
    return previous ? { versionHistory: previous } : {};
  const entries = Array.isArray(previous?.entries) ? [...previous.entries] : [];
  if (before) {
    const stamp = raw?.updatedAt as { toMillis?: () => number } | undefined,
      known = previous?.revision === before.revision;
    entries.push({
      mutationId:
        typeof raw?.mutationId === "string" ? raw.mutationId : "legacy",
      revision: before.revision,
      at: stamp?.toMillis?.() || 0,
      actorId: known ? previous?.actorId || uid : uid,
      actorName: known ? previous?.actorName || "" : "",
      source: known ? previous?.source || "legacy" : "legacy",
      payload: JSON.stringify(ProjectEntity.restore(before).snapshot()),
    });
  }
  while (entries.length > 20 || JSON.stringify(entries).length > 250000)
    entries.shift();
  return {
    versionHistory: {
      entries,
      revision,
      mutationId,
      actorId: uid,
      actorName: (user.displayName || "").slice(0, 100),
      source,
    },
  };
}

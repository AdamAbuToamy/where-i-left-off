import type { Project } from "../types";
import { ProjectEntity } from "../lib/projectEntity";
import type { ProjectChanges } from "../lib/projectEntity";
import { FeatureError } from "./schema";
export type CardVersion = {
  id: string;
  cardId: string;
  actorId: string;
  actorName: string;
  source: "workspace" | "assistant" | "legacy";
  at: number;
  before: Project | null;
  after: Project | null;
};
export function versionPayload(raw: unknown): {
  before: Project | null;
  after: Project | null;
} {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new FeatureError("experience-invalid");
  const r = raw as Record<string, unknown>;
  if (
    Object.keys(r).some((k) => k !== "before" && k !== "after") ||
    !("before" in r) ||
    !("after" in r)
  )
    throw new FeatureError("experience-invalid");
  return {
    before:
      r.before === null
        ? null
        : ProjectEntity.restore(r.before as Project).snapshot(),
    after:
      r.after === null
        ? null
        : ProjectEntity.restore(r.after as Project).snapshot(),
  };
}
export function restoreContent(
  current: Project,
  saved: Project,
  expectedRevision: number,
  now: number,
): ProjectChanges {
  if (current.id !== saved.id || current.revision !== expectedRevision)
    throw new FeatureError("experience-conflict");
  const {
    id: ignoreId,
    revision: ignoreRevision,
    rank: ignoreRank,
    activityAt: ignoreAt,
    completedAt: ignoreCompleted,
    ...fields
  } = ProjectEntity.restore(saved).snapshot();
  void ignoreId;
  void ignoreRevision;
  void ignoreRank;
  void ignoreAt;
  void ignoreCompleted;
  const validated = ProjectEntity.restore(current)
    .apply("edit", fields, expectedRevision, now)!
    .snapshot();
  return { ...fields, name: validated.name, nextStep: validated.nextStep };
}

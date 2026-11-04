import { parseExperience } from "./state";
import type { ExperienceState, Relation } from "./state";
import { FeatureError } from "./schema";
export function relate(
  state: ExperienceState,
  relation: Relation,
  available: Set<string>,
): ExperienceState {
  if (!available.has(relation.source) || !available.has(relation.target))
    throw new FeatureError("experience-missing");
  const same = (r: Relation) =>
    r.kind === relation.kind &&
    ((r.source === relation.source && r.target === relation.target) ||
      (r.kind === "related" &&
        r.target === relation.source &&
        r.source === relation.target));
  if (state.relations.some(same)) return state;
  return parseExperience({
    ...state,
    relations: [...state.relations, relation],
  });
}
export function blockers(
  state: ExperienceState,
  card: string,
  status: Map<string, string>,
) {
  return state.relations
    .filter(
      (r) =>
        r.source === card &&
        r.kind === "depends" &&
        status.get(r.target) !== "done",
    )
    .map((r) => r.target);
}

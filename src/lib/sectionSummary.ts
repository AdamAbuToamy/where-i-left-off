import type { Project, Section } from "../types";
/** One pass over each collection, including cards whose section was removed. */
export function sectionSummary(
  sections: readonly Pick<Section, "id">[],
  projects: readonly Pick<Project, "sectionId">[],
) {
  const ids = new Set(sections.map((section) => section.id));
  const counts = new Map<string, number>();
  let unassigned = 0;
  for (const project of projects) {
    const id = project.sectionId;
    if (!id || !ids.has(id)) unassigned++;
    else counts.set(id, (counts.get(id) || 0) + 1);
  }
  return { counts, unassigned };
}

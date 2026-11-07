import { performance } from "node:perf_hooks";
import assert from "node:assert/strict";
import { sectionSummary } from "../src/lib/sectionSummary.ts";
// Local synthetic input only. Never contacts production or processes account data.
const sections = Array.from({ length: 500 }, (_, id) => ({ id: String(id) }));
const projects = Array.from({ length: 10000 }, (_, id) => ({
  sectionId: String(id % 500),
}));
function measure(action) {
  const start = performance.now();
  const result = action();
  return { milliseconds: performance.now() - start, result };
}
const before = measure(
  () =>
    new Map(
      sections.map((section) => [
        section.id,
        projects.filter((project) => project.sectionId === section.id).length,
      ]),
    ),
);
const after = measure(() => sectionSummary(sections, projects));
assert.deepEqual(after.result.counts, before.result);
console.log(
  JSON.stringify(
    {
      kind: "local-synthetic-lookup-only",
      sections: sections.length,
      cards: projects.length,
      beforeComparisons: sections.length * projects.length,
      afterCardReads: projects.length,
      beforeMs: before.milliseconds,
      afterMs: after.milliseconds,
      countsEqual: true,
      notAProductionLoadTest: true,
    },
    null,
    2,
  ),
);

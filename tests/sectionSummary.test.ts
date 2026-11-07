import { it, expect } from "vitest";
import { sectionSummary } from "../src/lib/sectionSummary";
it("counts cards and orphaned sections without repeatedly scanning the collections", () => {
  let reads = 0;
  const sections = Array.from({ length: 500 }, (_, i) => ({ id: String(i) }));
  const cards = Array.from({ length: 10000 }, (_, i) => ({
    get sectionId() {
      reads++;
      return i % 11 === 0 ? "removed" : String(i % 500);
    },
  }));
  const result = sectionSummary(sections, cards);
  expect(reads).toBe(10000);
  expect(result.unassigned).toBe(910);
  expect([...result.counts.values()].reduce((sum, n) => sum + n, 0)).toBe(9090);
  expect(
    sectionSummary(sections, [{ sectionId: undefined }, { sectionId: "" }])
      .unassigned,
  ).toBe(2);
});

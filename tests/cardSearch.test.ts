import { expect, it } from "vitest";
import { matchesCardSearch } from "../src/lib/cardSearch";
it("matches all words in any order and ignores Arabic/Hebrew marks and whitespace", () => {
  expect(matchesCardSearch("مشروع تَجْرِبة الوِيلُو", "ويلو مشروع")).toBe(true);
  expect(matchesCardSearch("שָׁלוֹם עולם", "עולם שלום")).toBe(true);
  expect(matchesCardSearch("Plan the WEEK", " week  plan ")).toBe(true);
  expect(matchesCardSearch("plan", "plan missing")).toBe(false);
  expect(matchesCardSearch("anything", "   ")).toBe(true);
});

import { it, expect } from "vitest";
import { emptyExperience } from "../src/productivity/state";
import { prioritize, dailyCards } from "../src/productivity/priorities";
it("keeps at most three explicit priorities, supports removal and resets on a new day", () => {
  let s = emptyExperience();
  for (const id of ["a", "b", "c"])
    s = prioritize(s, "personal/" + id, "2026-11-04");
  expect(() => prioritize(s, "personal/d", "2026-11-04")).toThrow(
    "three-priorities",
  );
  expect(
    dailyCards(s, "2026-11-04", new Set(["personal/a", "personal/c"])),
  ).toEqual(["personal/a", "personal/c"]);
  s = prioritize(s, "personal/a", "2026-11-04");
  expect(s.today.cards).toHaveLength(2);
  s = prioritize(s, "personal/d", "2026-11-05");
  expect(s.today.cards).toEqual(["personal/d"]);
});

import { it, expect } from "vitest";
import { emptyExperience } from "../src/productivity/state";
import { schedule, schedulingConflicts } from "../src/productivity/scheduling";
it("separates work time from deadlines and detects class overlap in the explicit user timezone", () => {
  const block = {
      id: "a",
      card: "personal/a",
      start: "2026-11-04T09:00:00Z",
      minutes: 30,
    },
    lessons = [{ id: "class", day: 3, start: "10:45", end: "11:15" }];
  expect(schedulingConflicts(block, [], lessons, "Asia/Jerusalem")).toEqual([
    "lesson:class",
  ]);
  expect(() =>
    schedule(emptyExperience(), block, lessons, "Asia/Jerusalem"),
  ).toThrow("time-conflict");
  const accepted = schedule(
    emptyExperience(),
    block,
    lessons,
    "Asia/Jerusalem",
    true,
  );
  expect(accepted.blocks).toEqual([block]);
  expect(
    schedulingConflicts(
      { ...block, id: "b", start: "2026-11-04T09:15:00Z" },
      accepted.blocks,
      [],
      "UTC",
    ),
  ).toEqual(["block:a"]);
  expect(
    schedulingConflicts(
      { ...block, id: "b", start: "2026-11-04T09:30:00Z" },
      accepted.blocks,
      [],
      "UTC",
    ),
  ).toEqual([]);
});
it("checks the next local day when a work block crosses midnight", () => {
  expect(
    schedulingConflicts(
      {
        id: "a",
        card: "personal/a",
        start: "2026-11-04T23:45:00Z",
        minutes: 45,
      },
      [],
      [{ id: "class", day: 4, start: "00:00", end: "01:00" }],
      "UTC",
    ),
  ).toEqual(["lesson:class"]);
});

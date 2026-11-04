import { it, expect } from "vitest";
import { emptyExperience } from "../src/productivity/state";
import { reviewCandidates, reviewLater } from "../src/productivity/review";
import type { Project } from "../src/types";
it("snoozes review without changing a deadline and still surfaces a due waiting follow-up", () => {
  const now = Date.parse("2026-11-04T12:00:00Z"),
    base: Project = {
      id: "a",
      name: "Card",
      nextStep: "Next",
      status: "later",
      revision: 0,
      rank: 0,
      activityAt: now - 60 * 86400000,
      dueDate: "2026-12-01",
    };
  expect(
    reviewCandidates([base], emptyExperience(), "2026-11-04", now),
  ).toHaveLength(1);
  const s = reviewLater(emptyExperience(), "personal/a", "2026-11-11", now);
  expect(reviewCandidates([base], s, "2026-11-04", now)).toHaveLength(0);
  expect(base.dueDate).toBe("2026-12-01");
  expect(
    reviewCandidates(
      [{ ...base, status: "waiting", followUpDate: "2026-11-03" }],
      emptyExperience(),
      "2026-11-04",
      now,
    ),
  ).toHaveLength(1);
  expect(
    reviewCandidates(
      [{ ...base, trashedAt: now }],
      emptyExperience(),
      "2026-11-04",
      now,
    ),
  ).toHaveLength(0);
});

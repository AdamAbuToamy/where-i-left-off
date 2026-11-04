import { it, expect } from "vitest";
import {
  emptyCoursePlan,
  checkedCoursePlan,
  weightedGrade,
  examReviewPlan,
} from "../src/productivity/study";
it("calculates partial weighted grades without pretending the remaining weight is graded", () => {
  const p = {
    ...emptyCoursePlan("c"),
    grades: [{ id: "g", title: "Exam", score: 80, maximum: 100, weight: 50 }],
  };
  expect(weightedGrade(p)).toEqual({
    coveredWeight: 50,
    earnedPoints: 40,
    gradedAverage: 80,
    remainingWeight: 50,
  });
  expect(() =>
    checkedCoursePlan({
      ...p,
      grades: [
        ...p.grades,
        { id: "h", title: "Other", score: 1, maximum: 1, weight: 60 },
      ],
    }),
  ).toThrow();
  expect(() =>
    checkedCoursePlan({ ...p, grades: [{ ...p.grades[0], maximum: 0 }] }),
  ).toThrow();
});
it("builds a bounded exam plan before the exam and keeps every study topic", () => {
  const p = examReviewPlan("A\nB\nC\nD", "2026-11-06", "2026-11-04");
  expect(p.map((r) => r.date)).toEqual(["2026-11-04", "2026-11-05"]);
  expect(p.flatMap((r) => r.topics).sort()).toEqual(["A", "B", "C", "D"]);
  expect(examReviewPlan("A", "2026-11-04", "2026-11-04")).toEqual([]);
});

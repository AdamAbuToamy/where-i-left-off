import type { CoursePlan } from "./state";
import { parseExperience, emptyExperience } from "./state";
export const emptyCoursePlan = (id: string): CoursePlan => ({
  id,
  checkpoint: "",
  nextStep: "",
  examDate: "",
  topics: "",
  resources: [],
  grades: [],
  showGrades: false,
});
export function checkedCoursePlan(plan: CoursePlan) {
  return parseExperience({ ...emptyExperience(), courses: [plan] }).courses[0];
}
export function weightedGrade(plan: CoursePlan) {
  const valid = checkedCoursePlan(plan),
    coveredWeight = valid.grades.reduce((n, g) => n + g.weight, 0),
    earnedPoints = valid.grades.reduce(
      (n, g) => n + (g.score / g.maximum) * g.weight,
      0,
    );
  return {
    coveredWeight,
    earnedPoints,
    gradedAverage: coveredWeight ? (earnedPoints / coveredWeight) * 100 : null,
    remainingWeight: 100 - coveredWeight,
  };
}
export function examReviewPlan(
  topics: string,
  examDate: string,
  today: string,
): { date: string; topics: string[] }[] {
  const start = Date.parse(today + "T00:00:00Z"),
    end = Date.parse(examDate + "T00:00:00Z"),
    days = Math.min(14, Math.floor((end - start) / 86400000));
  if (!Number.isFinite(days) || days < 1) return [];
  const lines = topics
      .split("\n")
      .map((t) => t.replace(/^\s*[-*]\s*/, "").trim())
      .filter(Boolean)
      .slice(0, 100),
    count = Math.min(days, lines.length);
  return Array.from({ length: count }, (_, index) => ({
    date: new Date(start + index * 86400000).toISOString().slice(0, 10),
    topics: lines.filter((_, i) => i % count === index),
  }));
}

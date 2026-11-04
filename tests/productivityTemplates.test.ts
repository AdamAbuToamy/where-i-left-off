import { it, expect } from "vitest";
import {
  nextRepeatDate,
  latestDue,
  occurrence,
  advanceRepeat,
  templateFromCard,
} from "../src/productivity/templates";
import { emptyExperience } from "../src/productivity/state";
import type { RepeatRule } from "../src/productivity/state";
import type { Project } from "../src/types";
const rule: RepeatRule = {
  id: "rule1",
  card: "personal/a",
  frequency: "monthly",
  next: "2026-01-31",
  anchor: 31,
  lastOccurrence: "",
  enabled: true,
  automatic: false,
};
it("keeps the original monthly day through short months and leap years", () => {
  expect(nextRepeatDate("2026-01-31", "monthly", 31)).toBe("2026-02-28");
  expect(nextRepeatDate("2026-02-28", "monthly", 31)).toBe("2026-03-31");
  expect(nextRepeatDate("2028-01-31", "monthly", 31)).toBe("2028-02-29");
  expect(latestDue(rule, "2026-11-04")).toBe("2026-10-31");
});
it("uses a deterministic occurrence identity and resets completion without editing the source", () => {
  const source: Project = {
    id: "a",
    name: "Repeat",
    nextStep: "Next",
    status: "done",
    rank: 0,
    revision: 3,
    checklist: "[x] Completed",
  };
  expect(occurrence(rule, source)).toEqual(occurrence(rule, source));
  expect(occurrence(rule, source).details).toMatchObject({
    status: "later",
    checklist: "[ ] Completed",
    dueDate: "2026-01-31",
  });
  expect(source.status).toBe("done");
  const state = { ...emptyExperience(), repeat: [rule] };
  expect(advanceRepeat(state, rule, rule.next).repeat[0].next).toBe(
    "2026-02-28",
  );
  expect(() =>
    advanceRepeat(advanceRepeat(state, rule, rule.next), rule, rule.next),
  ).toThrow("conflict");
  expect(templateFromCard(source, "template", "Reusable")).not.toHaveProperty(
    "dueDate",
  );
});

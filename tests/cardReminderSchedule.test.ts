import { expect, test } from "vitest";
import {
  normalizeCardSchedule,
  resolveCardSchedule,
} from "../shared/cardReminderSchedule.mjs";
import { reminderFromInput, reminderInstant } from "../shared/reminderTime.mjs";
const defaults = {
  timezone: "Asia/Jerusalem",
  defaultTime: "09:00",
  time: "23:59",
};
test("three calendar days at09:00 are distinct from a72-hour duration", () => {
  const calendar = normalizeCardSchedule(
    { mode: "relative", amount: 3, unit: "days", localTime: "09:00" },
    defaults,
  );
  expect(resolveCardSchedule(calendar, "2026-11-18")).toBe(
    Date.parse("2026-11-15T07:00:00Z"),
  );
  const duration = normalizeCardSchedule(
    { mode: "relative", amount: 72, unit: "hours" },
    defaults,
  );
  expect(resolveCardSchedule(duration, "2026-11-18")).toBe(
    Date.parse("2026-11-15T21:59:00Z"),
  );
});
test("weeks use calendar dates and explicit schedules retain timezone/defaults", () => {
  const schedule = normalizeCardSchedule(
    { mode: "relative", amount: 1, unit: "weeks", localTime: "09:00" },
    defaults,
  );
  defaults.defaultTime = "14:00";
  expect(resolveCardSchedule(schedule, "2026-11-18")).toBe(
    Date.parse("2026-11-11T07:00:00Z"),
  );
  defaults.defaultTime = "09:00";
});
test("DST gaps/ambiguities reject local input while explicit offsets select either real instant", () => {
  expect(reminderFromInput("2027-03-14T02:30", "America/New_York")).toBeNull();
  expect(reminderFromInput("2027-11-07T01:30", "America/New_York")).toBeNull();
  expect(
    reminderFromInput("2027-11-07T01:30", "America/New_York", "earlier"),
  ).toBe("2027-11-07T05:30:00.000Z");
  expect(
    reminderFromInput("2027-11-07T01:30", "America/New_York", "later"),
  ).toBe("2027-11-07T06:30:00.000Z");
  const relative = normalizeCardSchedule(
    {
      mode: "relative",
      amount: 1,
      unit: "days",
      localTime: "01:30",
      timeZone: "America/New_York",
      disambiguation: "later",
    },
    defaults,
  );
  expect(resolveCardSchedule(relative, "2027-11-08")).toBe(
    Date.parse("2027-11-07T06:30:00Z"),
  );
  const first = normalizeCardSchedule(
    {
      mode: "absolute",
      scheduledAt: "2027-11-07T01:30:00-04:00",
      timeZone: "America/New_York",
    },
    defaults,
  );
  const second = normalizeCardSchedule(
    {
      mode: "absolute",
      scheduledAt: "2027-11-07T01:30:00-05:00",
      timeZone: "America/New_York",
    },
    defaults,
  );
  expect(resolveCardSchedule(second) - resolveCardSchedule(first)).toBe(
    3600000,
  );
  expect(() =>
    normalizeCardSchedule(
      {
        mode: "absolute",
        scheduledAt: "2027-03-14T02:30:00-05:00",
        timeZone: "America/New_York",
      },
      defaults,
    ),
  ).toThrow("timezone-offset-mismatch");
  expect(reminderInstant("2027-02-30T09:00:00Z")).toBeNull();
  expect(reminderFromInput("2027-02-30T09:00", "UTC")).toBeNull();
});
test("malformed schedule proposals, unsafe offsets and invalid zones cannot bypass validation", () => {
  for (const input of [
    { mode: "relative", amount: -1, unit: "days" },
    { mode: "relative", amount: 1.5, unit: "hours" },
    { mode: "relative", amount: 2, unit: "hours", localTime: "09:00" },
    { mode: "absolute", scheduledAt: "tomorrow" },
    { mode: "relative", amount: 3, unit: "days", timeZone: "invalid-zone" },
  ])
    expect(() => normalizeCardSchedule(input, defaults)).toThrow();
});

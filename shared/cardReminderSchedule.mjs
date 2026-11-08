import {
  validLeadMinutes,
  reminderInstant,
  strictZonedTime,
  validCalendarDate,
  localParts,
} from "./reminderTime.mjs";
export function scheduleZone(zone) {
  if (typeof zone !== "string" || zone.length > 100)
    throw Error("invalid-reminder-schedule");
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone }).format();
  } catch {
    throw Error("invalid-reminder-schedule");
  }
  return zone;
}
const clock = (value) =>
  typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
/** Explicit values are frozen here: later account defaults never rewrite user intent. */
export function normalizeCardSchedule(input, defaults) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw Error("invalid-reminder-schedule");
  const allowed =
    input.mode === "absolute"
      ? ["mode", "scheduledAt", "timeZone"]
      : [
          "mode",
          "amount",
          "unit",
          "localTime",
          "timeZone",
          "dueTime",
          "disambiguation",
        ];
  if (Object.keys(input).some((k) => !allowed.includes(k)))
    throw Error("invalid-reminder-schedule");
  const timeZone = scheduleZone(input.timeZone ?? defaults.timezone);
  if (input.mode === "absolute") {
    const at = reminderInstant(input.scheduledAt);
    if (at === null) throw Error("invalid-reminder-schedule");
    if (input.timeZone && !input.scheduledAt.endsWith("Z")) {
      const local = localParts(at, timeZone);
      if (local.date + "T" + local.time !== input.scheduledAt.slice(0, 16))
        throw Error("timezone-offset-mismatch");
    }
    return {
      mode: "absolute",
      scheduledAt: input.scheduledAt,
      timeZone,
    };
  }
  if (
    input.mode !== "relative" ||
    !validLeadMinutes(input.amount) ||
    !["minutes", "hours", "days", "weeks"].includes(input.unit)
  )
    throw Error("invalid-reminder-schedule");
  if (
    input.disambiguation !== undefined &&
    !["earlier", "later"].includes(input.disambiguation)
  )
    throw Error("invalid-reminder-schedule");
  const choice = input.disambiguation
    ? { disambiguation: input.disambiguation }
    : {};
  const dueTime = input.dueTime ?? defaults.time ?? defaults.defaultTime;
  if (!clock(dueTime)) throw Error("invalid-reminder-schedule");
  if (["minutes", "hours"].includes(input.unit)) {
    if (
      input.localTime !== undefined ||
      !validLeadMinutes(input.amount * (input.unit === "hours" ? 60 : 1))
    )
      throw Error("invalid-reminder-schedule");
    return {
      mode: "relative",
      amount: input.amount,
      unit: input.unit,
      dueTime,
      timeZone,
      ...choice,
    };
  }
  const localTime = input.localTime ?? defaults.defaultTime;
  if (!clock(localTime) || input.amount > 365000)
    throw Error("invalid-reminder-schedule");
  return {
    mode: "relative",
    amount: input.amount,
    unit: input.unit,
    localTime,
    dueTime,
    timeZone,
    ...choice,
  };
}
export function resolveCardSchedule(schedule, dueDate) {
  if (schedule?.mode === "absolute")
    return reminderInstant(schedule.scheduledAt);
  if (schedule?.mode !== "relative" || !validCalendarDate(dueDate)) return null;
  if (["days", "weeks"].includes(schedule.unit)) {
    const date = new Date(dueDate + "T12:00:00Z");
    date.setUTCDate(
      date.getUTCDate() - schedule.amount * (schedule.unit === "weeks" ? 7 : 1),
    );
    if (!Number.isFinite(date.getTime())) return null;
    return strictZonedTime(
      date.toISOString().slice(0, 10),
      schedule.localTime,
      schedule.timeZone,
      schedule.disambiguation,
    );
  }
  const due = strictZonedTime(
    dueDate,
    schedule.dueTime,
    schedule.timeZone,
    schedule.disambiguation,
  );
  return due === null
    ? null
    : due - schedule.amount * (schedule.unit === "hours" ? 60 : 1) * 60000;
}
export function explicitReminderEvent(project, card) {
  let at = card.schedule
    ? resolveCardSchedule(card.schedule, project.dueDate)
    : card.remindAt
      ? reminderInstant(card.remindAt)
      : null;
  if (at === null) return null;
  return {
    at,
    event: {
      type: "scheduled",
      key:
        "scheduled:" +
        at +
        ":" +
        JSON.stringify(card.schedule || { remindAt: card.remindAt }),
      date: new Date(at).toISOString().slice(0, 10),
    },
  };
}

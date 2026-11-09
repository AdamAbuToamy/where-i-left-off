import {
  normalizeCardSchedule,
  resolveCardSchedule,
} from "./cardReminderSchedule.mjs";
import {
  validLeadMinutes,
  reminderInstant,
  zonedTime,
} from "./reminderTime.mjs";
export function cardReminderUpdate(old, body, project, p, now) {
  for (const key of ["disabled", "weekly"])
    if (body[key] !== undefined && typeof body[key] !== "boolean")
      throw Error("invalid-input");
  if (
    body.time !== undefined &&
    (typeof body.time !== "string" ||
      !/^$|^([01]\d|2[0-3]):[0-5]\d$/.test(body.time))
  )
    throw Error("invalid-input");
  const next = {
    ...old,
    disabled: body.disabled ?? old.disabled ?? false,
    weekly: body.weekly ?? old.weekly ?? false,
    time: body.time ?? old.time ?? "",
  };
  if (body.leadMinutes !== undefined) {
    if (body.leadMinutes === null) delete next.leadMinutes;
    else {
      if (!validLeadMinutes(body.leadMinutes)) throw Error("invalid-input");
      next.leadMinutes = body.leadMinutes;
      delete next.schedule;
      delete next.remindAt;
    }
  }
  if (body.remindAt !== undefined) {
    if (body.remindAt === null) delete next.remindAt;
    else {
      if (reminderInstant(body.remindAt) === null) throw Error("invalid-input");
      next.schedule = normalizeCardSchedule(
        { mode: "absolute", scheduledAt: body.remindAt },
        p,
      );
      delete next.remindAt;
      delete next.leadMinutes;
      next.weekly = false;
    }
  }
  if (body.schedule !== undefined) {
    if (body.schedule === null) delete next.schedule;
    else {
      next.schedule = normalizeCardSchedule(body.schedule, {
        ...p,
        time: next.time || p.defaultTime,
      });
      delete next.remindAt;
      delete next.leadMinutes;
      next.weekly = false;
    }
  }
  if (body.schedule !== undefined || body.remindAt !== undefined)
    delete next.legacyCancelled;
  if (next.schedule) {
    const at = resolveCardSchedule(next.schedule, project.dueDate);
    if (at === null) throw Error("invalid-reminder-schedule");
    if (
      !next.disabled &&
      at <= now &&
      JSON.stringify(next.schedule) !== JSON.stringify(old.schedule)
    )
      throw Error("reminder-time-in-past");
  } else if (
    body.leadMinutes !== undefined &&
    body.leadMinutes !== null &&
    !next.disabled
  ) {
    const at = zonedTime(
      project.dueDate,
      next.time || p.defaultTime,
      p.timezone,
    );
    if (at === null || at - next.leadMinutes * 60000 <= now)
      throw Error("reminder-time-in-past");
  }
  return next;
}

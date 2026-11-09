import { explicitReminderEvent } from "../shared/cardReminderSchedule.mjs";
import {
  localParts,
  zonedTime,
  validLeadMinutes,
  reminderInstant,
} from "../shared/reminderTime.mjs";
export {
  localParts,
  zonedTime,
  validLeadMinutes,
  reminderInstant,
} from "../shared/reminderTime.mjs";
export const reminderLeads = Object.freeze([0, 15, 60, 1440, 4320, 5760]);
export const reminderLead = (card, p) =>
  validLeadMinutes(card.leadMinutes) ? card.leadMinutes : p.leadMinutes;
export const defaults = {
  enabled: false,
  due: true,
  stale: false,
  staleDays: 14,
  defaultTime: "09:00",
  leadMinutes: 0,
  quiet: true,
  quietStart: "22:00",
  quietEnd: "08:00",
  hideContent: true,
  timezone: "UTC",
  language: "ar",
};
export const clock = (value) =>
  typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
export function preferences(input) {
  const p = { ...defaults, ...input };
  if (
    !["enabled", "due", "stale", "quiet", "hideContent"].every(
      (k) => typeof p[k] === "boolean",
    ) ||
    ![7, 14, 30, 60, 90].includes(p.staleDays) ||
    !reminderLeads.includes(p.leadMinutes) ||
    !["ar", "en", "he"].includes(p.language) ||
    ![p.defaultTime, p.quietStart, p.quietEnd].every(clock)
  )
    throw new Error("invalid-preferences");
  if (typeof p.timezone !== "string" || p.timezone.length > 100)
    throw new Error("invalid-timezone");
  new Intl.DateTimeFormat("en", { timeZone: p.timezone }).format();
  return Object.fromEntries(Object.keys(defaults).map((key) => [key, p[key]]));
}
export function quietNow(p, now) {
  if (!p.quiet || p.quietStart === p.quietEnd) return false;
  const { time } = localParts(now, p.timezone);
  return p.quietStart < p.quietEnd
    ? time >= p.quietStart && time < p.quietEnd
    : time >= p.quietStart || time < p.quietEnd;
}
export function cardKey(id, groupId = "") {
  return `${groupId || "personal"}__${id}`;
}
export function candidate(project, card, p, now, enabledAt) {
  if (project.archivedAt || project.trashedAt || card.disabled || card.legacyCancelled) return null;
  if (card.schedule || card.remindAt) {
    const plan = explicitReminderEvent(project, card);
    return plan &&
      plan.at >= enabledAt &&
      now >= plan.at &&
      now - plan.at < 86400000
      ? plan.event
      : null;
  }
  if (project.status === "done") return null;
  const lead = reminderLead(card, p);
  const local = localParts(now, p.timezone);
  const dueTime = card.time || p.defaultTime;
  if (p.due && project.dueDate) {
    let date = project.dueDate;
    if (card.weekly) {
      // Include the upcoming occurrence when the advance reminder crosses midnight.
      const future = localParts(now + lead * 60000, p.timezone).date;
      const day = new Date(`${date}T12:00Z`).getUTCDay();
      const anchor = new Date(`${future}T12:00Z`);
      anchor.setUTCDate(
        anchor.getUTCDate() - ((anchor.getUTCDay() - day + 7) % 7),
      );
      date = anchor.toISOString().slice(0, 10);
    }
    const due = zonedTime(date, dueTime, p.timezone);
    const remind = due === null ? null : due - lead * 60000;
    // Catch short scheduler interruptions, without replaying old reminders.
    if (
      remind !== null &&
      date >= project.dueDate &&
      remind >= enabledAt &&
      now >= remind &&
      now - remind < 24 * 3600000
    )
      return { type: "due", key: `due:${date}:${dueTime}:${lead}`, date };
  }
  const last = Math.max(
    project.activityAt || project.updatedAt?.toMillis?.() || enabledAt,
    card.lastViewedAt || 0,
    enabledAt,
  );
  if (
    p.stale &&
    now - last >= p.staleDays * 86400000 &&
    local.time >= p.defaultTime &&
    (!card.lastStaleAt || now - card.lastStaleAt >= p.staleDays * 86400000)
  )
    return { type: "stale", key: `stale:${local.date}:${last}` };
  return null;
}
export function validSubscription(s) {
  if (
    !s ||
    typeof s.endpoint !== "string" ||
    s.endpoint.length > 2048 ||
    typeof s.keys?.auth !== "string" ||
    typeof s.keys?.p256dh !== "string"
  )
    return false;
  try {
    const u = new URL(s.endpoint);
    const allowed =
      u.hostname === "fcm.googleapis.com" ||
      u.hostname === "updates.push.services.mozilla.com" ||
      u.hostname.endsWith(".push.apple.com") ||
      u.hostname === "web.push.apple.com" ||
      u.hostname.endsWith(".notify.windows.com");
    return (
      allowed &&
      u.protocol === "https:" &&
      !u.port &&
      !u.username &&
      !u.password &&
      !u.hash &&
      /^[A-Za-z0-9_-]{16,100}={0,2}$/.test(s.keys.auth) &&
      /^[A-Za-z0-9_-]{80,200}={0,2}$/.test(s.keys.p256dh)
    );
  } catch {
    return false;
  }
}

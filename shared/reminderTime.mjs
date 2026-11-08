const formatters = new Map();
export function localParts(now, timezone) {
  if (!formatters.has(timezone))
    formatters.set(
      timezone,
      new Intl.DateTimeFormat("en-GB", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }),
    );
  const parts = Object.fromEntries(
    formatters
      .get(timezone)
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}
// Resolve the local wall clock in the user's zone, including DST. A missing
// spring-forward time is skipped; an ambiguous time resolves to one occurrence.
export function zonedTime(date, time, timezone) {
  if (!validCalendarDate(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))
    return null;
  const target = Date.parse(`${date}T${time}:00Z`);
  if (!Number.isFinite(target)) return null;
  let result = target;
  for (let i = 0; i < 5; i++) {
    const local = localParts(result, timezone);
    const delta = target - Date.parse(`${local.date}T${local.time}:00Z`);
    if (!delta) return result;
    result += delta;
  }
  return null;
}

export const validLeadMinutes = (value) =>
  Number.isSafeInteger(value) &&
  value >= 0 &&
  value <= Math.floor(Number.MAX_SAFE_INTEGER / 60000);
export function reminderInstant(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value,
    )
  )
    return null;
  const at = Date.parse(value);
  return validCalendarDate(value.slice(0, 10)) &&
    Number(value.slice(11, 13)) < 24 &&
    Number(value.slice(14, 16)) < 60 &&
    Number(value.slice(17, 19)) < 60 &&
    Number.isFinite(at)
    ? at
    : null;
}
export function reminderInput(value, timezone) {
  const at = reminderInstant(value);
  if (at === null) return "";
  const p = localParts(at, timezone);
  return p.date + "T" + p.time;
}
export function reminderFromInput(value, timezone, disambiguation) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const at = strictZonedTime(
    value.slice(0, 10),
    value.slice(11),
    timezone,
    disambiguation,
  );
  return at === null ? null : new Date(at).toISOString();
}

export function validCalendarDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const at = Date.parse(value + "T00:00:00Z");
  return (
    Number.isFinite(at) && new Date(at).toISOString().slice(0, 10) === value
  );
}
export function zonedCandidates(date, time, zone) {
  if (!validCalendarDate(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))
    return [];
  const target = Date.parse(date + "T" + time + ":00Z"),
    matches = new Set();
  for (const delta of [-36, 0, 36]) {
    const probe = target + delta * 3600000,
      p = localParts(probe, zone),
      offset = Date.parse(p.date + "T" + p.time + ":00Z") - probe,
      at = target - offset,
      actual = localParts(at, zone);
    if (actual.date === date && actual.time === time) matches.add(at);
  }
  return [...matches].sort((a, b) => a - b);
}
export function strictZonedTime(date, time, zone, disambiguation) {
  const candidates = zonedCandidates(date, time, zone);
  return candidates.length === 1
    ? candidates[0]
    : candidates.length > 1
      ? disambiguation === "earlier"
        ? candidates[0]
        : disambiguation === "later"
          ? candidates.at(-1)
          : null
      : null;
}

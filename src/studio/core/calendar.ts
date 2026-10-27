import type { StudioState } from "./model";
const escapeText = (value: string) =>
  value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
const utc = (value: number) =>
  new Date(value)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
function fold(line: string): string {
  const encoder = new TextEncoder();
  let length = 0,
    part = "";
  const lines: string[] = [];
  for (const c of line) {
    const size = encoder.encode(c).length;
    if (length + size > 73) {
      lines.push(part);
      part = " ";
      length = 1;
    }
    part += c;
    length += size;
  }
  lines.push(part);
  return lines.join("\r\n");
}
/** RFC 5545: UTC deadlines and local recurring class times, bounded by semester. */
export function studioCalendar(
  state: StudioState,
  now: number,
  courseId = "",
): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//WILO//Admin Studio//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];
  const courses = state.data.study.courses.filter(
    (c) =>
      (!courseId || c.id === courseId) &&
      !state.semesters.find((t) => t.id === state.courseSemesters[c.id])
        ?.archived,
  );
  for (const task of state.data.study.tasks.filter(
    (t) => !t.done && !!t.due && courses.some((c) => c.id === t.courseId),
  )) {
    lines.push(
      "BEGIN:VEVENT",
      "UID:task-" + task.id + "@wilo.local",
      "DTSTAMP:" + utc(now),
      "DTSTART:" + utc(Date.parse(task.due)),
      "SUMMARY:" + escapeText(task.title),
      "DESCRIPTION:" +
        escapeText(
          (courses.find((c) => c.id === task.courseId)?.name || "") +
            "\n" +
            task.notes,
        ),
      "END:VEVENT",
    );
  }
  for (const lesson of state.data.study.lessons.filter((l) =>
    courses.some((c) => c.id === l.courseId),
  )) {
    const term = state.semesters.find(
      (t) => t.id === state.courseSemesters[lesson.courseId],
    );
    const start = new Date(term?.start ? term.start + "T12:00:00" : now);
    start.setHours(12, 0, 0, 0);
    start.setDate(start.getDate() + ((lesson.day - start.getDay() + 7) % 7));
    const local = [
      start.getFullYear(),
      String(start.getMonth() + 1).padStart(2, "0"),
      String(start.getDate()).padStart(2, "0"),
    ].join("-");
    if (term?.end && local > term.end) continue;
    const date = local.replaceAll("-", "");
    const until = term?.end
      ? "UNTIL=" + term.end.replaceAll("-", "") + "T235959"
      : "COUNT=16";
    lines.push(
      "BEGIN:VEVENT",
      "UID:lesson-" + lesson.id + "@wilo.local",
      "DTSTAMP:" + utc(now),
      "DTSTART:" + date + "T" + lesson.start.replace(":", "") + "00",
      "DTEND:" + date + "T" + lesson.end.replace(":", "") + "00",
      "RRULE:FREQ=WEEKLY;" + until,
      "SUMMARY:" +
        escapeText(courses.find((c) => c.id === lesson.courseId)?.name || ""),
      "LOCATION:" + escapeText(lesson.room),
      "DESCRIPTION:" + escapeText(lesson.notes || ""),
      "END:VEVENT",
    );
  }
  return lines.concat("END:VCALENDAR").map(fold).join("\r\n") + "\r\n";
}
export function studioCsv(state: StudioState): string {
  const cell = (value: string) =>
    '"' +
    (/^[=+@\-\t\r]/.test(value) ? "'" : "") +
    value.replaceAll('"', '""') +
    '"';
  const rows = [["type", "name", "course / space", "due", "done"]];
  for (const scope of state.data.scopes)
    for (const p of scope.projects)
      rows.push([
        "card",
        p.name,
        scope.name,
        p.dueDate || "",
        String(p.status === "done"),
      ]);
  for (const task of state.data.study.tasks)
    rows.push([
      "study-task",
      task.title,
      state.data.study.courses.find((c) => c.id === task.courseId)?.name || "",
      task.due,
      String(task.done),
    ]);
  return rows.map((row) => row.map(cell).join(",")).join("\r\n");
}

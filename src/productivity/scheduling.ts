import { parseExperience } from "./state";
import type { ExperienceState, TimeBlock } from "./state";
import { FeatureError } from "./schema";
export type BusyLesson = {
  id: string;
  day: number;
  start: string;
  end: string;
};
export function schedulingConflicts(
  block: TimeBlock,
  others: TimeBlock[],
  lessons: BusyLesson[],
  timeZone: string,
): string[] {
  const start = Date.parse(block.start),
    end = start + block.minutes * 60000;
  if (!Number.isFinite(start)) throw new FeatureError("experience-invalid");
  const conflicts = new Set(
    others
      .filter(
        (b) =>
          b.id !== block.id &&
          start < Date.parse(b.start) + b.minutes * 60000 &&
          end > Date.parse(b.start),
      )
      .map((b) => "block:" + b.id),
  );
  const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }),
    days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  for (let at = start; at < end; at += 60000) {
    const parts = Object.fromEntries(
        formatter.formatToParts(at).map((p) => [p.type, p.value]),
      ),
      weekday = days.indexOf(parts.weekday),
      minute = Number(parts.hour) * 60 + Number(parts.minute);
    for (const lesson of lessons) {
      const from =
          Number(lesson.start.slice(0, 2)) * 60 + Number(lesson.start.slice(3)),
        to = Number(lesson.end.slice(0, 2)) * 60 + Number(lesson.end.slice(3));
      if (lesson.day === weekday && minute >= from && minute < to)
        conflicts.add("lesson:" + lesson.id);
    }
  }
  return [...conflicts];
}
export function schedule(
  state: ExperienceState,
  block: TimeBlock,
  lessons: BusyLesson[],
  timeZone: string,
  allowConflict = false,
): ExperienceState {
  const next = parseExperience({
    ...state,
    blocks: [...state.blocks.filter((b) => b.id !== block.id), block],
  });
  if (
    !allowConflict &&
    schedulingConflicts(block, state.blocks, lessons, timeZone).length
  )
    throw new FeatureError("experience-time-conflict");
  return next;
}

export function localParts(
  now: number,
  timezone: string,
): { date: string; time: string };
export function zonedTime(
  date: string,
  time: string,
  timezone: string,
  disambiguation?: "earlier" | "later",
): number | null;
export function validLeadMinutes(value: unknown): value is number;
export function reminderInstant(value: unknown): number | null;
export function reminderInput(value: unknown, timezone: string): string;
export function reminderFromInput(
  value: string,
  timezone: string,
  disambiguation?: "earlier" | "later",
): string | null;
export function strictZonedTime(
  date: string,
  time: string,
  timezone: string,
  disambiguation?: "earlier" | "later",
): number | null;
export function validCalendarDate(value: unknown): boolean;

export function zonedCandidates(
  date: string,
  time: string,
  timezone: string,
): number[];

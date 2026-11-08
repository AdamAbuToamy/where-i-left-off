export type CardSchedule =
  | { mode: "absolute"; scheduledAt: string; timeZone: string }
  | {
      mode: "relative";
      amount: number;
      unit: "minutes" | "hours" | "days" | "weeks";
      timeZone: string;
      dueTime: string;
      localTime?: string;
      disambiguation?: "earlier" | "later";
    };
export function normalizeCardSchedule(
  input: unknown,
  defaults: { timezone: string; time?: string; defaultTime: string },
): CardSchedule;
export function resolveCardSchedule(
  schedule: CardSchedule,
  dueDate?: string,
): number | null;
export function scheduleZone(zone: string): string;
export function explicitReminderEvent(
  project: { dueDate?: string },
  card: { schedule?: CardSchedule; remindAt?: string },
): {
  at: number;
  event: { type: "scheduled"; key: string; date: string };
} | null;

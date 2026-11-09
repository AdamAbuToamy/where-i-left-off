import {
  normalizeCardSchedule,
  resolveCardSchedule,
} from "../../shared/cardReminderSchedule.mjs";
import type { PushPreferences } from "../../src/lib/pushNotifications";
import type { CardSchedule } from "../../shared/cardReminderSchedule.mjs";
type Item = {
  id: string;
  revision: number;
  schedule: CardSchedule;
  status: string;
  scheduledAt: string | null;
  effectiveAt: string | null;
  timeZone: string;
  state: string;
};
export function reminderCollectionFixture(
  prefs: PushPreferences,
  changed: (key: string, schedule: CardSchedule) => void,
) {
  const records = new Map<string, Item[]>();
  return (
    data: {
      action: string;
      projectId: string;
      groupId?: string;
      reminderId?: string;
      body?: { schedule?: CardSchedule };
    },
    base: Record<string, unknown>,
  ) => {
    if (
      ![
        "reminders-list",
        "reminder-create",
        "reminder-update",
        "reminder-delete",
      ].includes(data.action)
    )
      return undefined;
    const key = (data.groupId || "personal") + "__" + data.projectId,
      items = records.get(key) || [];
    if (
      data.action === "reminder-create" ||
      data.action === "reminder-update"
    ) {
      const schedule = normalizeCardSchedule(data.body?.schedule, prefs),
        at = resolveCardSchedule(
          schedule,
          String(base.dueDate || "2099-11-18"),
        );
      const old = items.find((x) => x.id === data.reminderId),
        id = old?.id || "r_" + String(items.length + 1).padStart(24, "0");
      const item: Item = {
        id,
        revision: old ? old.revision + 1 : 0,
        schedule,
        status: "scheduled",
        scheduledAt: at === null ? null : new Date(at).toISOString(),
        effectiveAt: at === null ? null : new Date(at).toISOString(),
        timeZone: schedule.timeZone,
        state: "active",
      };
      if (old) items[items.indexOf(old)] = item;
      else items.push(item);
      changed(key, schedule);
    }
    if (data.action === "reminder-delete") {
      const item = items.find((x) => x.id === data.reminderId);
      if (item) {
        item.state = "cancelled";
        item.status = "cancelled";
        item.revision++;
      }
    }
    records.set(key, items);
    return {
      items,
      preferences: prefs,
      cardDisabled: false,
      settingsVersion: base.settingsVersion || "0".repeat(64),
    };
  };
}

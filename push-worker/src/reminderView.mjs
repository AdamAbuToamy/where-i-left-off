import {
  isExplicitLegacyReminder,
  legacyDefaultSuppressed,
  legacyReminderSource,
} from "../../shared/legacyReminder.mjs";
import { legacyTerminal, reminderRows } from "./cardReminderRecords.mjs";
import {
  preferences,
  cardKey,
  reminderLead,
  zonedTime,
  dueEvent,
  localParts,
} from "../policy.mjs";
import { explicitReminderEvent } from "../../shared/cardReminderSchedule.mjs";
import { afterQuiet } from "../schedule.mjs";
import { sha256, stableJson } from "../../shared/apiHash.mjs";
import * as store from "./store.mjs";
export async function readReminderView(
  env,
  uid,
  project,
  groupId = "",
  now = Date.now(),
) {
  const key = cardKey(project.id, groupId),
    card = await store.card(env, uid, key),
    account = await store.account(env, uid),
    p = preferences(JSON.parse(account.prefs));
  const scopes = await env.DB.prepare(
      "SELECT next_at FROM scopes WHERE uid=? AND scope=?",
    )
      .bind(uid, groupId)
      .first(),
    devices = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM devices WHERE uid=?",
    )
      .bind(uid)
      .first();
  let plan = explicitReminderEvent(project, card),
    at = plan?.at ?? null,
    event = plan?.event;
  if (!card.schedule && !card.remindAt && project.dueDate) {
    let date = project.dueDate;
    const lead = reminderLead(card, p);
    if (card.weekly) {
      const future = localParts(now + lead * 60000, p.timezone).date,
        day = new Date(date + "T12:00Z").getUTCDay(),
        anchor = new Date(future + "T12:00Z");
      anchor.setUTCDate(
        anchor.getUTCDate() - ((anchor.getUTCDay() - day + 7) % 7),
      );
      date = anchor.toISOString().slice(0, 10);
      if (date < project.dueDate) date = project.dueDate;
    }
    const resolve = () => {
      const due = zonedTime(date, card.time || p.defaultTime, p.timezone);
      at = due === null ? null : due - lead * 60000;
      event =
        at === null ? null : dueEvent(date, card.time || p.defaultTime, lead);
    };
    resolve();
    if (card.weekly) {
      const claimed = event
        ? await env.DB.prepare(
            "SELECT event_key FROM events WHERE uid=? AND id=? AND type='due'",
          )
            .bind(uid, key)
            .first()
        : null;
      if (
        at === null ||
        at < account.enabled_at ||
        now - at >= 86400000 ||
        (at <= now && claimed?.event_key === event?.key)
      ) {
        const next = new Date(date + "T12:00Z");
        next.setUTCDate(next.getUTCDate() + 7);
        date = next.toISOString().slice(0, 10);
        resolve();
      }
    }
  }

  if (
    groupId &&
    project.assignedTo !== uid &&
    !isExplicitLegacyReminder(card)
  ) {
    at = null;
    event = null;
  }
  const terminal = await legacyTerminal(env, uid, key, card);
  if (terminal) {
    at = terminal.scheduled_at;
    event = {
      type: terminal.event_key.startsWith("due:") ? "due" : "scheduled",
      key: terminal.event_key,
    };
  }
  const dispatches = event
    ? (
        await env.DB.prepare(
          "SELECT state,COUNT(*) AS n FROM reminder_dispatches WHERE uid=? AND card_key=? AND event_key=? GROUP BY state",
        )
          .bind(uid, key, event.key)
          .all()
      ).results
    : [];
  const counts = Object.fromEntries(
    dispatches.map((row) => [row.state, row.n]),
  );
  let status =
    !p.enabled ||
    card.disabled ||
    project.archivedAt ||
    project.trashedAt ||
    (!card.schedule && !card.remindAt && (project.status === "done" || !p.due))
      ? "disabled"
      : at === null
        ? !card.schedule &&
          !card.remindAt &&
          (!project.dueDate || (groupId && project.assignedTo !== uid))
          ? "not-configured"
          : "invalid-schedule"
        : at < account.enabled_at || now - at >= 86400000
          ? "expired"
          : !devices.n
            ? "awaiting-device"
            : !scopes
              ? "pending"
              : "scheduled";
  if (event) {
    if (counts["provider-accepted"]) status = "provider-accepted";
    else if (counts.unknown) status = "unknown";
    else if (counts.failed) status = "failed";
    else if (counts.sending) status = "dispatching";
    else {
      const claimed = await env.DB.prepare(
        "SELECT event_key FROM events WHERE uid=? AND id=? AND type=?",
      )
        .bind(uid, key, event.type)
        .first();
      if (
        claimed?.event_key === event.key &&
        !["expired", "disabled"].includes(status)
      )
        status = now - at > 120000 ? "unknown" : "push-queued";
    }
  }
  const source = legacyReminderSource(card);
  const suppressed = legacyDefaultSuppressed(
    card,
    (await reminderRows(env, uid, key)).length,
  );
  // Historical dispatch evidence remains truthful even when defaults are suppressed.
  if (
    suppressed &&
    ["scheduled", "pending", "awaiting-device", "push-queued"].includes(status)
  )
    status = "superseded";
  if (card.legacyCancelled) status = "cancelled";
  return {
    source,
    suppressed,
    projectId: project.id,
    dueDate: project.dueDate || "",
    disabled: !!card.disabled,
    weekly: !!card.weekly,
    time: card.time || "",
    leadMinutes: reminderLead(card, p),
    schedule: card.schedule || null,
    remindAt: card.remindAt || null,
    settingsVersion: await sha256(stableJson(card)),
    configured: !!Object.keys(card).length,
    deliveryEnabled: p.enabled,
    status,
    scheduled: status === "scheduled",
    scheduledAt: at === null ? null : new Date(at).toISOString(),
    effectiveAt:
      at === null ||
      ["expired", "not-configured", "invalid-schedule", "cancelled"].includes(
        status,
      )
        ? null
        : new Date(afterQuiet(p, at)).toISOString(),
    timeZone: card.schedule?.timeZone || p.timezone,
    nextCheckAt: scopes?.next_at ?? null,
    providerAccepted: counts["provider-accepted"] || 0,
    deliveryCounts: counts,
    handsetDelivery: "not-confirmed",
    preferences: p,
  };
}

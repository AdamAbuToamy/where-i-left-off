import { isExplicitLegacyReminder } from "../../shared/legacyReminder.mjs";
import { ApiError, object } from "../../shared/universityApiPlan.mjs";
import {
  normalizeCardSchedule,
  resolveCardSchedule,
} from "../../shared/cardReminderSchedule.mjs";
import { sha256, stableJson } from "../../shared/apiHash.mjs";
import { cardKey, preferences } from "../policy.mjs";
import { afterQuiet } from "../schedule.mjs";
import * as store from "./store.mjs";
export const legacyConfig = (card) =>
  card.schedule
    ? stableJson(card.schedule)
    : card.remindAt ||
      (isExplicitLegacyReminder(card) && !card.weekly
        ? stableJson({
            type: "due",
            time: card.time || "",
            leadMinutes: card.leadMinutes ?? null,
            intent: card.apiReminderIntent || null,
          })
        : "");
export async function reminderRows(env, uid, key) {
  return (
    await env.DB.prepare(
      "SELECT * FROM card_reminders WHERE uid=? AND card_key=? AND id<>? ORDER BY created_at,id",
    )
      .bind(uid, key, "legacy")
      .all()
  ).results;
}
export async function reminderRow(env, uid, key, id) {
  return env.DB.prepare(
    "SELECT * FROM card_reminders WHERE uid=? AND card_key=? AND id=?",
  )
    .bind(uid, key, id)
    .first();
}
export async function legacyTerminal(env, uid, key, card) {
  const config = legacyConfig(card);
  if (!config) return null;
  const row = await reminderRow(env, uid, key, "legacy");
  return row?.legacy_config === config ? row : null;
}
export function recordEvent(row, project) {
  const at =
    row.started_at !== null
      ? row.scheduled_at
      : resolveCardSchedule(JSON.parse(row.schedule), project.dueDate);
  return at === null
    ? null
    : {
        at,
        event: {
          type: "scheduled",
          key: "multi:" + row.id + ":" + row.revision + ":" + at,
          date: new Date(at).toISOString().slice(0, 10),
        },
      };
}
export async function recordView(
  env,
  uid,
  key,
  row,
  project,
  p,
  card,
  now = Date.now(),
) {
  const plan = recordEvent(row, project),
    at = plan?.at ?? null,
    eventKey = row.event_key || plan?.event.key;
  const counts = eventKey
    ? Object.fromEntries(
        (
          await env.DB.prepare(
            "SELECT state,COUNT(*) AS n FROM reminder_dispatches WHERE uid=? AND card_key=? AND event_key=? GROUP BY state",
          )
            .bind(uid, key, eventKey)
            .all()
        ).results.map((r) => [r.state, r.n]),
      )
    : {};
  const targets = JSON.parse(row.device_ids),
    finished =
      (counts["provider-accepted"] || 0) +
      (counts.failed || 0) +
      (counts.unknown || 0) +
      (counts.skipped || 0),
    attempted = Object.values(counts).reduce((a, b) => a + b, 0);
  let status =
    row.state === "cancelled"
      ? "cancelled"
      : counts.sending
        ? now - row.started_at > 120000
          ? "unknown"
          : "dispatching"
        : finished >= targets.length && targets.length
          ? counts.unknown
            ? "unknown"
            : counts["provider-accepted"]
              ? counts["provider-accepted"] === targets.length
                ? "provider-accepted"
                : "partially-accepted"
              : "failed"
          : finished || attempted
            ? "push-queued"
            : !p.enabled ||
                card.disabled ||
                project.archivedAt ||
                project.trashedAt
              ? "disabled"
              : at === null
                ? "invalid-schedule"
                : now - at >= 86400000
                  ? "expired"
                  : row.queued_at
                    ? "push-queued"
                    : "scheduled";
  const devices = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM devices WHERE uid=?",
  )
    .bind(uid)
    .first();
  if (status === "scheduled" && !devices.n) status = "awaiting-device";
  return {
    source: "independent",
    suppressed: false,
    id: row.id,
    revision: row.revision,
    schedule: JSON.parse(row.schedule),
    state: row.state,
    status,
    scheduledAt: at === null ? null : new Date(at).toISOString(),
    nextScheduledAt:
      ["scheduled", "push-queued", "dispatching"].includes(status) &&
      at !== null
        ? new Date(afterQuiet(p, at)).toISOString()
        : null,
    effectiveAt: at === null ? null : new Date(afterQuiet(p, at)).toISOString(),
    timeZone: JSON.parse(row.schedule).timeZone,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    providerAccepted: counts["provider-accepted"] || 0,
    deliveryCounts: counts,
    handsetDelivery: "not-confirmed",
  };
}
export async function mutateReminder(
  env,
  uid,
  project,
  groupId,
  method,
  id,
  body,
  key,
) {
  const ck = cardKey(project.id, groupId),
    account = await store.account(env, uid),
    p = preferences(JSON.parse(account.prefs));
  object(
    body,
    method === "POST"
      ? ["schedule", "enableCard", "expectedSettingsVersion"]
      : method === "DELETE"
        ? ["expectedRevision"]
        : ["schedule", "expectedRevision"],
    method === "POST"
      ? ["schedule"]
      : method === "PATCH"
        ? ["schedule", "expectedRevision"]
        : ["expectedRevision"],
  );
  if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]{15,127}$/.test(key || ""))
    throw new ApiError("idempotency-key-required");
  const keyHash = await sha256(key),
    fingerprint = await sha256(stableJson({ ck, method, id, body }));
  const receipt = await env.DB.prepare(
    "SELECT * FROM card_reminder_operations WHERE uid=? AND key_hash=?",
  )
    .bind(uid, keyHash)
    .first();
  if (receipt) {
    if (receipt.fingerprint !== fingerprint)
      throw new ApiError("idempotency-key-reused");
    await store.wake(env, uid, groupId);
    const existing = await reminderRow(env, uid, ck, receipt.reminder_id);
    return recordView(
      env,
      uid,
      ck,
      existing,
      project,
      p,
      await store.card(env, uid, ck),
    );
  }
  if (method === "POST")
    id = "r_" + (await sha256(uid + "|" + ck + "|" + key)).slice(0, 24);
  if (!/^r_[a-f0-9]{24}$/.test(id || ""))
    throw new ApiError("resource-not-found");
  const old = await reminderRow(env, uid, ck, id);
  if (method !== "POST" && !old) throw new ApiError("resource-not-found");
  if (
    method !== "POST" &&
    (!Number.isSafeInteger(body.expectedRevision) ||
      body.expectedRevision !== old.revision)
  )
    throw new ApiError("revision-conflict");
  let schedule = old ? JSON.parse(old.schedule) : null;
  if (method !== "DELETE") {
    try {
      schedule = normalizeCardSchedule(body.schedule, {
        ...p,
        time: (await store.card(env, uid, ck)).time || p.defaultTime,
      });
      const at = resolveCardSchedule(schedule, project.dueDate);
      if (at === null) throw Error("invalid-reminder-schedule");
      if (at <= Date.now()) throw Error("reminder-time-in-past");
    } catch (e) {
      throw new ApiError(
        ["reminder-time-in-past", "timezone-offset-mismatch"].includes(
          e.message,
        )
          ? e.message
          : "invalid-reminder-schedule",
      );
    }
  }
  if (body.enableCard !== undefined && typeof body.enableCard !== "boolean")
    throw new ApiError("invalid-input");
  const now = Date.now(),
    state = method === "DELETE" ? "cancelled" : "active",
    revision = old ? old.revision + 1 : 0;
  let cardGuard = "",
    cardGuardArgs = [];
  if (body.enableCard) {
    const card = await store.card(env, uid, ck);
    if (body.expectedSettingsVersion !== (await sha256(stableJson(card))))
      throw new ApiError("reminder-settings-conflict");
    const raw = await env.DB.prepare(
      "SELECT settings FROM cards WHERE uid=? AND id=?",
    )
      .bind(uid, ck)
      .first();
    cardGuard = raw
      ? " AND EXISTS(SELECT 1 FROM cards WHERE uid=? AND id=? AND settings=?)"
      : " AND NOT EXISTS(SELECT 1 FROM cards WHERE uid=? AND id=?)";
    cardGuardArgs = raw ? [uid, ck, raw.settings] : [uid, ck];
  }
  const guard =
    "NOT EXISTS(SELECT 1 FROM card_reminder_operations WHERE uid=? AND key_hash=?)" +
    cardGuard;
  const mutation =
    method === "POST"
      ? env.DB.prepare(
          `INSERT INTO card_reminders(uid,card_key,id,schedule,revision,state,created_at,updated_at) SELECT ?,?,?,?,?,?,?,? WHERE ${guard} AND (SELECT COUNT(*) FROM card_reminders WHERE uid=? AND card_key=? AND id<>'legacy')<100 ON CONFLICT(uid,card_key,id) DO NOTHING`,
        ).bind(
          uid,
          ck,
          id,
          JSON.stringify(schedule),
          revision,
          state,
          now,
          now,
          uid,
          keyHash,
          ...cardGuardArgs,
          uid,
          ck,
        )
      : env.DB.prepare(
          `UPDATE card_reminders SET schedule=?,revision=?,state=?,updated_at=?,queued_at=0,event_key='',scheduled_at=NULL,device_ids='[]',started_at=NULL WHERE uid=? AND card_key=? AND id=? AND revision=? AND ${guard}`,
        ).bind(
          JSON.stringify(schedule),
          revision,
          state,
          now,
          uid,
          ck,
          id,
          body.expectedRevision,
          uid,
          keyHash,
          ...cardGuardArgs,
        );
  const batch = [
    mutation,
    env.DB.prepare(
      "INSERT INTO card_reminder_operations(uid,key_hash,fingerprint,card_key,reminder_id,created_at) SELECT ?,?,?,?,?,? WHERE changes()=1 AND EXISTS(SELECT 1 FROM card_reminders WHERE uid=? AND card_key=? AND id=? AND revision=? AND state=?) ON CONFLICT(uid,key_hash) DO NOTHING",
    ).bind(
      uid,
      keyHash,
      fingerprint,
      ck,
      id,
      now,
      uid,
      ck,
      id,
      revision,
      state,
    ),
  ];
  if (body.enableCard) {
    const card = await store.card(env, uid, ck);
    if (body.expectedSettingsVersion !== (await sha256(stableJson(card))))
      throw new ApiError("reminder-settings-conflict");
    batch.push(
      env.DB.prepare(
        "UPDATE cards SET settings=json_set(settings,'$.disabled',json('false')) WHERE uid=? AND id=? AND EXISTS(SELECT 1 FROM card_reminder_operations WHERE uid=? AND key_hash=? AND fingerprint=?)",
      ).bind(uid, ck, uid, keyHash, fingerprint),
    );
  }
  await env.DB.batch(batch);
  const accepted = await env.DB.prepare(
    "SELECT * FROM card_reminder_operations WHERE uid=? AND key_hash=?",
  )
    .bind(uid, keyHash)
    .first();
  if (!accepted)
    throw new ApiError(
      body.enableCard
        ? "reminder-settings-conflict"
        : method === "POST"
          ? "reminder-limit"
          : "revision-conflict",
    );
  if (accepted.fingerprint !== fingerprint)
    throw new ApiError("idempotency-key-reused");
  await store.wake(env, uid, groupId);
  return recordView(
    env,
    uid,
    ck,
    await reminderRow(env, uid, ck, id),
    project,
    p,
    await store.card(env, uid, ck),
  );
}
export async function beginRecord(
  env,
  uid,
  ck,
  id,
  revision,
  event,
  at,
  devices,
) {
  const r = await env.DB.prepare(
    "UPDATE card_reminders SET scheduled_at=?,event_key=?,device_ids=CASE WHEN queued_at=0 THEN ? ELSE device_ids END WHERE uid=? AND card_key=? AND id=? AND revision=? AND state='active'",
  )
    .bind(at, event.key, JSON.stringify(devices), uid, ck, id, revision)
    .run();
  return !!r.meta.changes;
}
export async function markRecordQueued(env, uid, ck, id, revision) {
  await env.DB.prepare(
    "UPDATE card_reminders SET queued_at=? WHERE uid=? AND card_key=? AND id=? AND revision=? AND state='active'",
  )
    .bind(Date.now(), uid, ck, id, revision)
    .run();
}
export async function startRecordDispatch(env, uid, ck, id, revision, event) {
  const r = await env.DB.prepare(
    "UPDATE card_reminders SET started_at=COALESCE(started_at,?) WHERE uid=? AND card_key=? AND id=? AND revision=? AND state='active' AND event_key=?",
  )
    .bind(Date.now(), uid, ck, id, revision, event.key)
    .run();
  return !!r.meta.changes;
}
export async function freezeLegacy(env, uid, ck, card, event, at) {
  const config = legacyConfig(card);
  if (!config || !["due", "scheduled"].includes(event.type)) return;
  const now = Date.now();
  await env.DB.prepare(
    "INSERT INTO card_reminders(uid,card_key,id,schedule,state,created_at,updated_at,scheduled_at,started_at,event_key,legacy_config) VALUES(?,?,'legacy',?,'active',?,?,?,?,?,?) ON CONFLICT(uid,card_key,id) DO UPDATE SET schedule=excluded.schedule,scheduled_at=excluded.scheduled_at,started_at=excluded.started_at,event_key=excluded.event_key,legacy_config=excluded.legacy_config WHERE legacy_config<>excluded.legacy_config",
  )
    .bind(
      uid,
      ck,
      JSON.stringify(
        card.schedule || {
          mode: "absolute",
          scheduledAt: card.remindAt || new Date(at).toISOString(),
          timeZone: "UTC",
        },
      ),
      now,
      now,
      at,
      now,
      event.key,
      config,
    )
    .run();
}

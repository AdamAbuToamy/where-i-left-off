import { ApiError, object } from "../../shared/universityApiPlan.mjs";
import { sha256, stableJson } from "../../shared/apiHash.mjs";
import { cardReminderUpdate } from "../../shared/cardReminderUpdate.mjs";
import { preferences, cardKey } from "../policy.mjs";
import * as store from "./store.mjs";
import { readReminderView } from "./reminderView.mjs";
import {
  reminderRows,
  reminderRow,
  recordView,
  mutateReminder,
} from "./cardReminderRecords.mjs";
export async function readReminderCollection(
  env,
  uid,
  project,
  groupId = "",
  id,
) {
  const ck = cardKey(project.id, groupId),
    card = await store.card(env, uid, ck),
    p = preferences(JSON.parse((await store.account(env, uid)).prefs));
  const legacy = await readReminderView(env, uid, project, groupId),
    rows = await reminderRows(env, uid, ck);
  const explicit = !!(
    card.schedule ||
    card.remindAt ||
    card.weekly ||
    card.leadMinutes !== undefined ||
    card.legacyCancelled
  );
  const items = await Promise.all(
    rows.map((row) => recordView(env, uid, ck, row, project, p, card)),
  );
  if (explicit || (!rows.length && legacy.scheduledAt))
    items.unshift({
      ...legacy,
      id: "legacy",
      revision: null,
      settingsVersion: legacy.settingsVersion,
      state: card.legacyCancelled ? "cancelled" : "legacy",
      status: card.legacyCancelled ? "cancelled" : legacy.status,
      legacy: true,
      nextScheduledAt: card.legacyCancelled
        ? null
        : legacy.scheduled
          ? legacy.effectiveAt
          : null,
    });
  if (id) {
    const item = items.find((v) => v.id === id);
    if (!item) throw new ApiError("resource-not-found");
    return item;
  }
  return {
    projectId: project.id,
    dueDate: project.dueDate || "",
    cardDisabled: !!card.disabled,
    preferences: p,
    settingsVersion: legacy.settingsVersion,
    items,
    limit: 100,
  };
}
export async function mutateReminderCollection(
  env,
  uid,
  project,
  groupId,
  method,
  id,
  body,
  key,
) {
  if (id !== "legacy")
    return mutateReminder(env, uid, project, groupId, method, id, body, key);
  object(
    body,
    method === "DELETE"
      ? ["expectedSettingsVersion"]
      : ["schedule", "expectedSettingsVersion"],
    method === "DELETE"
      ? ["expectedSettingsVersion"]
      : ["schedule", "expectedSettingsVersion"],
  );
  if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]{15,127}$/.test(key || ""))
    throw new ApiError("idempotency-key-required");
  const ck = cardKey(project.id, groupId),
    kh = await sha256(key),
    fp = await sha256(stableJson({ ck, method, id, body })),
    receipt = await env.DB.prepare(
      "SELECT * FROM card_reminder_operations WHERE uid=? AND key_hash=?",
    )
      .bind(uid, kh)
      .first();
  if (receipt) {
    if (receipt.fingerprint !== fp)
      throw new ApiError("idempotency-key-reused");
    await store.wake(env, uid, groupId);
    return readReminderCollection(env, uid, project, groupId, id);
  }
  const card = await store.card(env, uid, ck);
  if ((await sha256(stableJson(card))) !== body.expectedSettingsVersion)
    throw new ApiError("reminder-settings-conflict");
  let next;
  if (method === "DELETE") next = { ...card, legacyCancelled: true };
  else {
    const p = preferences(JSON.parse((await store.account(env, uid)).prefs));
    try {
      next = cardReminderUpdate(
        card,
        { schedule: body.schedule },
        project,
        p,
        Date.now(),
      );
    } catch (e) {
      throw new ApiError(e.message);
    }
    delete next.legacyCancelled;
  }
  const raw = await env.DB.prepare(
      "SELECT settings FROM cards WHERE uid=? AND id=?",
    )
      .bind(uid, ck)
      .first(),
    json = JSON.stringify(next);
  const guard =
    "NOT EXISTS(SELECT 1 FROM card_reminder_operations WHERE uid=? AND key_hash=?)";
  const statement = raw
    ? env.DB.prepare(
        `UPDATE cards SET settings=? WHERE uid=? AND id=? AND settings=? AND ${guard}`,
      ).bind(json, uid, ck, raw.settings, uid, kh)
    : env.DB.prepare(
        `INSERT INTO cards(uid,id,settings) SELECT ?,?,? WHERE ${guard} ON CONFLICT(uid,id) DO NOTHING`,
      ).bind(uid, ck, json, uid, kh);
  await env.DB.batch([
    statement,
    env.DB.prepare(
      "INSERT INTO card_reminder_operations(uid,key_hash,fingerprint,card_key,reminder_id,created_at) SELECT ?,?,?,?,?,? WHERE changes()=1 AND EXISTS(SELECT 1 FROM cards WHERE uid=? AND id=? AND settings=?) ON CONFLICT(uid,key_hash) DO NOTHING",
    ).bind(uid, kh, fp, ck, id, Date.now(), uid, ck, json),
  ]);
  const final = await env.DB.prepare(
    "SELECT fingerprint FROM card_reminder_operations WHERE uid=? AND key_hash=?",
  )
    .bind(uid, kh)
    .first();
  if (!final) throw new ApiError("reminder-settings-conflict");
  if (final.fingerprint !== fp) throw new ApiError("idempotency-key-reused");
  await store.wake(env, uid, groupId);
  return readReminderCollection(env, uid, project, groupId, id);
}

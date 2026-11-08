import { ApiError, object } from "../../shared/universityApiPlan.mjs";
import { cardReminderUpdate } from "../../shared/cardReminderUpdate.mjs";
import { sha256, stableJson } from "../../shared/apiHash.mjs";
import { preferences, cardKey } from "../policy.mjs";
import { readReminderView } from "./reminderView.mjs";
import * as store from "./store.mjs";
export async function updateApiCardReminder(
  env,
  uid,
  project,
  body,
  idempotencyKey,
  path,
  method = "PUT",
) {
  object(
    body,
    [
      "disabled",
      "weekly",
      "time",
      "leadMinutes",
      "remindAt",
      "schedule",
      "expectedSettingsVersion",
    ],
    [],
  );
  if (
    !["disabled", "weekly", "time", "leadMinutes", "remindAt", "schedule"].some(
      (k) => body[k] !== undefined,
    )
  )
    throw new ApiError("invalid-input");
  const key = cardKey(project.id),
    old = await store.card(env, uid, key),
    account = await store.account(env, uid);
  const advanced =
    method === "DELETE" ||
    body.schedule !== undefined ||
    body.remindAt !== undefined ||
    body.leadMinutes !== undefined;
  let keyHash, fingerprint;
  if (advanced) {
    if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]{15,127}$/.test(idempotencyKey || ""))
      throw new ApiError("idempotency-key-required");
    keyHash = await sha256(idempotencyKey);
    fingerprint = await sha256(stableJson({ path, method, body }));
    const receipt = await env.DB.prepare(
      "SELECT fingerprint,project_id FROM api_reminder_requests WHERE uid=? AND key_hash=?",
    )
      .bind(uid, keyHash)
      .first();
    if (receipt) {
      if (
        receipt.fingerprint !== fingerprint ||
        receipt.project_id !== project.id
      )
        throw new ApiError("idempotency-key-reused");
      await store.wake(env, uid);
      return readReminderView(env, uid, project);
    }
    if (
      typeof body.expectedSettingsVersion !== "string" ||
      !/^[a-f0-9]{64}$/.test(body.expectedSettingsVersion)
    )
      throw new ApiError("invalid-input");
  }
  if (
    body.expectedSettingsVersion !== undefined &&
    (await sha256(stableJson(old))) !== body.expectedSettingsVersion
  )
    throw new ApiError("reminder-settings-conflict");
  let next;
  try {
    next = cardReminderUpdate(
      old,
      body,
      project,
      preferences(JSON.parse(account.prefs)),
      Date.now(),
    );
  } catch (error) {
    throw new ApiError(
      [
        "reminder-time-in-past",
        "timezone-offset-mismatch",
        "invalid-reminder-schedule",
      ].includes(error.message)
        ? error.message
        : "invalid-input",
    );
  }
  const raw = await env.DB.prepare(
    "SELECT settings FROM cards WHERE uid=? AND id=?",
  )
    .bind(uid, key)
    .first();
  if (
    body.expectedSettingsVersion !== undefined &&
    (await sha256(stableJson(raw ? JSON.parse(raw.settings) : {}))) !==
      body.expectedSettingsVersion
  )
    throw new ApiError("reminder-settings-conflict");
  const updated = JSON.stringify(next),
    version = await sha256(stableJson(next));
  // Guard the mutation inside the same D1 transaction as its receipt. Two
  // concurrent resources must never both change under one operation key.
  const guard = advanced
    ? " AND NOT EXISTS(SELECT 1 FROM api_reminder_requests WHERE uid=? AND key_hash=?)"
    : "";
  const mutation = raw
    ? env.DB.prepare(
        "UPDATE cards SET settings=? WHERE uid=? AND id=? AND settings=?" +
          guard,
      ).bind(
        updated,
        uid,
        key,
        raw.settings,
        ...(advanced ? [uid, keyHash] : []),
      )
    : env.DB.prepare(
        "INSERT INTO cards(uid,id,settings) SELECT ?,?,? WHERE 1=1" +
          guard +
          " ON CONFLICT(uid,id) DO NOTHING",
      ).bind(uid, key, updated, ...(advanced ? [uid, keyHash] : []));
  if (advanced) {
    const results = await env.DB.batch([
      mutation,
      env.DB.prepare(
        "INSERT INTO api_reminder_requests(uid,key_hash,fingerprint,project_id,response_version,created_at) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM cards WHERE uid=? AND id=? AND settings=?) ON CONFLICT(uid,key_hash) DO NOTHING",
      ).bind(
        uid,
        keyHash,
        fingerprint,
        project.id,
        version,
        Date.now(),
        uid,
        key,
        updated,
      ),
    ]);
    const receipt = await env.DB.prepare(
      "SELECT fingerprint,project_id FROM api_reminder_requests WHERE uid=? AND key_hash=?",
    )
      .bind(uid, keyHash)
      .first();
    if (!receipt) throw new ApiError("reminder-settings-conflict");
    if (
      receipt.fingerprint !== fingerprint ||
      receipt.project_id !== project.id
    )
      throw new ApiError("idempotency-key-reused");
    if (
      !results[0].meta.changes &&
      JSON.stringify(await store.card(env, uid, key)) !== updated
    )
      throw new ApiError("reminder-settings-conflict");
  } else {
    const result = await mutation.run();
    if (!result.meta.changes) throw new ApiError("reminder-settings-conflict");
  }
  await store.wake(env, uid);
  return readReminderView(env, uid, project);
}

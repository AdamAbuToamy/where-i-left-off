import { ApiError } from "../../shared/universityApiPlan.mjs";
import { preferences, quietNow } from "../policy.mjs";
import { afterQuiet } from "../schedule.mjs";
import * as store from "./store.mjs";
import { sendPush } from "./push.mjs";
import { recordNotification } from "./notificationCenter.mjs";
export function createTaskNotificationStore(
  env,
  uid,
  { send = sendPush, now = () => Date.now(), resource = "tasks" } = {},
) {
  const db = env.DB;
  const internal = (id) => resource + ":" + id;
  const job = (id) =>
    db
      .prepare("SELECT * FROM api_task_notifications WHERE uid=? AND task_id=?")
      .bind(uid, internal(id))
      .first();
  return {
    job,
    async included(projectId) {
      return (
        !projectId ||
        !(await store.card(env, uid, "personal__" + projectId)).disabled
      );
    },
    async preferences() {
      const row = await store.account(env, uid);
      if (!row) throw new ApiError("account-unavailable");
      const p = preferences(JSON.parse(row.prefs));
      const devices = await db
        .prepare("SELECT id FROM devices WHERE uid=? ORDER BY id LIMIT 5")
        .bind(uid)
        .all();
      return { ...p, deviceIds: devices.results.map((d) => d.id) };
    },
    async create({
      id,
      keyHash,
      fingerprint,
      eventId,
      revision,
      deviceIds,
      at,
    }) {
      id = internal(id);
      const previous = await db
        .prepare(
          "SELECT fingerprint,task_id FROM api_task_notification_requests WHERE uid=? AND key_hash=?",
        )
        .bind(uid, keyHash)
        .first();
      if (
        previous &&
        (previous.fingerprint !== fingerprint || previous.task_id !== id)
      )
        throw new ApiError("idempotency-key-reused");
      if (!previous) {
        const count = await db
          .prepare(
            "SELECT COUNT(*) AS n FROM api_task_notification_requests WHERE uid=? AND task_id=?",
          )
          .bind(uid, id)
          .first();
        if (count.n >= 32) throw new ApiError("rate-limited");
      }
      await db.batch([
        db
          .prepare(
            "INSERT INTO api_task_notification_requests(uid,key_hash,fingerprint,task_id) SELECT ?,?,?,? WHERE (SELECT COUNT(*) FROM api_task_notification_requests WHERE uid=? AND task_id=?)<32 ON CONFLICT(uid,key_hash) DO NOTHING",
          )
          .bind(uid, keyHash, fingerprint, id, uid, id),
        db
          .prepare(
            "INSERT INTO api_task_notifications(uid,task_id,event_id,task_revision,device_ids,created_at,next_at) SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM api_task_notification_requests WHERE uid=? AND key_hash=? AND fingerprint=? AND task_id=?) ON CONFLICT(uid,task_id) DO NOTHING",
          )
          .bind(
            uid,
            id,
            eventId,
            revision,
            JSON.stringify(deviceIds),
            at,
            at,
            uid,
            keyHash,
            fingerprint,
            id,
          ),
      ]);
      const receipt = await db
        .prepare(
          "SELECT fingerprint,task_id FROM api_task_notification_requests WHERE uid=? AND key_hash=?",
        )
        .bind(uid, keyHash)
        .first();
      if (!receipt) throw new ApiError("rate-limited");
      if (receipt.fingerprint !== fingerprint || receipt.task_id !== id)
        throw new ApiError("idempotency-key-reused");
    },
    async enqueue(id) {
      id = internal(id);
      const result = await db
        .prepare(
          "UPDATE api_task_notifications SET next_at=? WHERE uid=? AND task_id=? AND state<>'complete' AND next_at<=? AND lease_until<=? RETURNING uid",
        )
        .bind(now() + 60000, uid, id, now(), now())
        .all();
      if (!result.results.length) return;
      await env.PUSH_QUEUE.send({
        type: "task-notification",
        uid,
        taskId: id,
        createdAt: now(),
      });
      await db
        .prepare(
          "UPDATE api_task_notifications SET queued_at=? WHERE uid=? AND task_id=?",
        )
        .bind(now(), uid, id)
        .run();
    },
    async claim(id) {
      id = internal(id);
      const result = await db
        .prepare(
          "UPDATE api_task_notifications SET state='processing',lease_until=?,next_at=? WHERE uid=? AND task_id=? AND state<>'complete' AND lease_until<=? RETURNING *",
        )
        .bind(now() + 120000, now() + 120000, uid, id, now())
        .all();
      return result.results[0] || null;
    },
    async defer(id, at) {
      id = internal(id);
      await db
        .prepare(
          "UPDATE api_task_notifications SET state='pending',next_at=?,lease_until=0,reason='quiet-hours' WHERE uid=? AND task_id=?",
        )
        .bind(at, uid, id)
        .run();
    },
    async sendOnce(id, deviceId, payload) {
      id = internal(id);
      const result = await db
        .prepare(
          "INSERT INTO api_task_notification_deliveries(uid,task_id,device_id,state,started_at) VALUES(?,?,?,'sending',?) ON CONFLICT(uid,task_id,device_id) DO NOTHING RETURNING uid",
        )
        .bind(uid, id, deviceId, now())
        .all();
      if (!result.results.length) {
        await db
          .prepare(
            "UPDATE api_task_notification_deliveries SET state='unknown' WHERE uid=? AND task_id=? AND device_id=? AND state='sending' AND started_at<=?",
          )
          .bind(uid, id, deviceId, now() - 120000)
          .run();
        return;
      }
      const device = await db
        .prepare("SELECT subscription FROM devices WHERE uid=? AND id=?")
        .bind(uid, deviceId)
        .first();
      let state = "skipped";
      if (device) {
        try {
          await send(env, JSON.parse(device.subscription), payload);
          state = "provider-accepted";
        } catch (error) {
          state = Number.isInteger(error?.status) ? "failed" : "unknown";
          if ([404, 410].includes(error?.status))
            await db
              .prepare("DELETE FROM devices WHERE uid=? AND id=?")
              .bind(uid, deviceId)
              .run();
        }
      }
      await db
        .prepare(
          "UPDATE api_task_notification_deliveries SET state=? WHERE uid=? AND task_id=? AND device_id=?",
        )
        .bind(state, uid, id, deviceId)
        .run();
      if (state === "provider-accepted")
        try {
          await recordNotification(
            env,
            uid,
            "task_" + payload.tag,
            payload,
            now(),
          );
        } catch {
          /* Provider acknowledgement is not repeated if optional history storage fails. */
        }
    },
    async finish(id, reason = "") {
      id = internal(id);
      const sending = await db
        .prepare(
          "SELECT 1 AS n FROM api_task_notification_deliveries WHERE uid=? AND task_id=? AND state='sending' LIMIT 1",
        )
        .bind(uid, id)
        .first();
      await db
        .prepare(
          "UPDATE api_task_notifications SET state=?,reason=?,lease_until=0,next_at=? WHERE uid=? AND task_id=?",
        )
        .bind(sending ? "pending" : "complete", reason, now() + 120000, uid, id)
        .run();
    },
    async status(id) {
      const item = await job(id);
      if (!item)
        return {
          resourceType: resource,
          resourceId: id,
          ...(resource === "tasks" ? { taskId: id } : { projectId: id }),
          status: "not-requested",
          accepted: false,
          providerAccepted: 0,
          handsetDelivery: "not-confirmed",
        };
      const rows = await db
        .prepare(
          "SELECT state,COUNT(*) AS n FROM api_task_notification_deliveries WHERE uid=? AND task_id=? GROUP BY state",
        )
        .bind(uid, internal(id))
        .all();
      const counts = Object.fromEntries(
        rows.results.map((r) => [r.state, r.n]),
      );
      const p = await this.preferences();
      let state =
        item.state === "complete"
          ? item.reason ||
            (counts.unknown || counts.sending
              ? "unknown"
              : counts["provider-accepted"]
                ? counts["provider-accepted"] ===
                  JSON.parse(item.device_ids).length
                  ? "provider-accepted"
                  : "partially-accepted"
                : "failed")
          : quietNow(p, now())
            ? "deferred"
            : item.state === "processing"
              ? "sending"
              : item.queued_at
                ? "queued"
                : "pending";
      return {
        resourceType: resource,
        resourceId: id,
        ...(resource === "tasks" ? { taskId: id } : { projectId: id }),
        eventId: item.event_id,
        status: state,
        accepted: true,
        queuedAt: item.queued_at || null,
        providerAccepted: counts["provider-accepted"] || 0,
        devices: JSON.parse(item.device_ids).length,
        counts,
        handsetDelivery: "not-confirmed",
        createdAt: item.created_at,
        nextAttemptAt:
          item.state === "complete"
            ? null
            : quietNow(p, now())
              ? afterQuiet(p, now())
              : item.next_at,
      };
    },
  };
}

import { ApiError } from "../../shared/universityApiPlan.mjs";
import { preferences, cardKey } from "../policy.mjs";
import * as store from "./store.mjs";
export function createApiReminderStore(env, uid) {
  const key = (id) => cardKey(id);
  return {
    async preferences() {
      const row = await store.account(env, uid);
      if (!row) throw new ApiError("account-unavailable");
      return {
        value: preferences(JSON.parse(row.prefs)),
        enabledAt: row.enabled_at,
      };
    },
    async read(id) {
      const row = await env.DB.prepare(
        "SELECT settings FROM cards WHERE uid=? AND id=?",
      )
        .bind(uid, key(id))
        .first();
      return row ? JSON.parse(row.settings) : null;
    },
    async claim(id, value) {
      await env.DB.prepare(
        "INSERT INTO cards(uid,id,settings) VALUES(?,?,?) ON CONFLICT(uid,id) DO NOTHING",
      )
        .bind(uid, key(id), JSON.stringify(value))
        .run();
      return this.read(id);
    },
    async enqueue(taskId) {
      await env.DB.prepare(
        "INSERT INTO api_reminder_work(uid,task_id,created_at,next_at) VALUES(?,?,?,?) ON CONFLICT(uid,task_id) DO UPDATE SET next_at=MIN(next_at,excluded.next_at)",
      )
        .bind(uid, taskId, Date.now(), Date.now() + 60000)
        .run();
    },
    async complete(taskId) {
      await env.DB.prepare(
        "DELETE FROM api_reminder_work WHERE uid=? AND task_id=?",
      )
        .bind(uid, taskId)
        .run();
    },
    async wake() {
      await store.wake(env, uid);
    },
    async schedule(taskId) {
      const row = await env.DB.prepare(
        "SELECT next_at FROM scopes WHERE uid=? AND scope='' ",
      )
        .bind(uid)
        .first();
      const devices = await env.DB.prepare(
        "SELECT COUNT(*) AS n FROM devices WHERE uid=?",
      )
        .bind(uid)
        .first();
      const pending = await env.DB.prepare(
        "SELECT 1 AS n FROM api_reminder_work WHERE uid=? AND task_id=?",
      )
        .bind(uid, taskId)
        .first();
      return {
        nextCheckAt: row?.next_at ?? null,
        hasDevice: !!devices?.n,
        recoveryPending: !!pending,
      };
    },
  };
}

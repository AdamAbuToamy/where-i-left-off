import { assertApiAccount, createApiRepository } from "./apiFirestore.mjs";
import { createApiReminderStore } from "./apiReminderStore.mjs";
import { createTaskReminderService } from "./apiTaskReminder.mjs";
/** Bounded reconciliation on the existing cron; this is not a delivery scheduler. */
export async function recoverApiReminderLinks(env) {
  const now = Date.now(),
    rows = await env.DB.prepare(
      "SELECT uid,task_id,created_at FROM api_reminder_work WHERE next_at<=? ORDER BY next_at LIMIT 10",
    )
      .bind(now)
      .all();
  for (const row of rows.results) {
    // Reserve the recovery hint for one minute; all resource operations remain transactional/idempotent.
    await env.DB.prepare(
      "UPDATE api_reminder_work SET next_at=? WHERE uid=? AND task_id=?",
    )
      .bind(now + 60000, row.uid, row.task_id)
      .run();
    try {
      await assertApiAccount(env, row.uid);
      const repository = createApiRepository(env, row.uid),
        reminders = createApiReminderStore(env, row.uid);
      const intent = await repository.transact((tx) =>
        tx.getMeta("university_reminder_" + row.task_id),
      );
      if (!intent) {
        if (now - row.created_at > 300000)
          await reminders.complete(row.task_id);
        continue;
      }
      await createTaskReminderService({
        repository,
        reminders,
        ownerUid: row.uid,
      }).resume(row.task_id);
    } catch {
      /* Fixed metadata only; retain uncertain work for the next native cron. */
    }
  }
}

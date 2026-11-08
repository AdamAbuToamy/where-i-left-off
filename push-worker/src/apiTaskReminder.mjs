import {
  normalizeCardSchedule,
  resolveCardSchedule,
} from "../../shared/cardReminderSchedule.mjs";
import { ApiError, object, validId } from "../../shared/universityApiPlan.mjs";
import { hydrateStudy } from "./apiStudyService.mjs";
import { ProjectEntity } from "../../shared/wiloApiDomain.mjs";
import { reminderCardFields } from "../../shared/universityReminder.mjs";
import { sha256, stableJson } from "../../shared/apiHash.mjs";
import {
  localParts,
  zonedTime,
  reminderLead,
  reminderLeads,
  validLeadMinutes,
} from "../policy.mjs";
import { afterQuiet } from "../schedule.mjs";
const fail = (code) => {
  throw new ApiError(code);
};
const preferencesHash = (p, explicit = false) =>
  sha256(
    stableJson(
      explicit
        ? { enabled: p.enabled }
        : {
            timezone: p.timezone,
            enabled: p.enabled,
            due: p.due,
            leadMinutes: p.leadMinutes,
            defaultTime: p.defaultTime,
          },
    ),
  );
/** Cross-store recovery is an application use case; the delivery scheduler is unchanged. */
export function createTaskReminderService({
  repository,
  reminders,
  ownerUid,
  now = () => Date.now(),
  uuid = () => crypto.randomUUID(),
}) {
  if (repository.uid !== ownerUid) fail("account-unavailable");
  const intentKey = (id) => "university_reminder_" + id;
  async function snapshot(tx, id) {
    if (!validId(id)) fail("invalid-input");
    const { data, records } = hydrateStudy(await tx.listStudy()),
      task = data.study.tasks.find((t) => t.id === id);
    if (!task) fail("resource-not-found");
    if (!data.study.courses.some((c) => c.id === task.courseId))
      fail("resource-not-found");
    const record = records.get("tasks_" + id),
      intent = await tx.getMeta(intentKey(id));
    let project = null;
    if (task.reminderProjectId) {
      if (
        !/^[A-Za-z0-9]{20}$/.test(task.reminderProjectId) ||
        data.study.tasks.some(
          (t) => t.id !== id && t.reminderProjectId === task.reminderProjectId,
        )
      )
        fail("reminder-link-conflict");
      project = await tx.getProject(task.reminderProjectId);
      if (
        !project ||
        project.kind !== "deadline" ||
        project.resourceType !== "course" ||
        project.trashedAt ||
        project.archivedAt
      )
        fail("reminder-link-conflict");
    }
    return { task, record, intent, project };
  }
  async function status(id) {
    const s = await repository.transact((tx) => snapshot(tx, id));
    if (!s.task.reminderProjectId)
      return {
        taskId: id,
        revision: s.record.revision,
        projectId: null,
        status: "unlinked",
        verified: true,
        scheduled: false,
      };
    const { value: p, enabledAt } = await reminders.preferences(),
      settings = await reminders.read(s.task.reminderProjectId),
      schedule = await reminders.schedule(id);
    if (reminders.view) {
      const actual = await reminders.view(s.project, s.task.reminderProjectId);
      const pending =
        s.intent?.state === "pending" ||
        (s.intent?.state === "complete" && schedule.recoveryPending);
      const state = pending
        ? "pending"
        : s.intent?.state === "blocked"
          ? "blocked"
          : actual.status;
      return {
        ...actual,
        taskId: id,
        revision: s.record.revision,
        projectId: s.task.reminderProjectId,
        status: state,
        verified: !["pending", "blocked", "incomplete"].includes(state),
        scheduled: state === "scheduled",
        reminderAt: actual.effectiveAt ? Date.parse(actual.effectiveAt) : null,
        timezone: actual.timeZone,
        settings: settings
          ? {
              disabled: !!settings.disabled,
              weekly: !!settings.weekly,
              time: settings.time || "",
            }
          : null,
        ...(s.intent?.reason ? { reason: s.intent.reason } : {}),
      };
    }
    let state =
      s.intent?.state === "pending" ||
      (s.intent?.state === "complete" && schedule.recoveryPending)
        ? "pending"
        : s.intent?.state === "blocked"
          ? "blocked"
          : "configured";
    let reminderAt = null;
    const validSettings =
      settings &&
      typeof settings.disabled === "boolean" &&
      typeof settings.weekly === "boolean" &&
      typeof settings.time === "string" &&
      /^$|^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(settings.time);
    if (!validSettings && state === "configured") state = "incomplete";
    if (state === "configured") {
      if (
        !p.enabled ||
        (!settings.schedule && !p.due) ||
        (!settings.schedule && s.task.done) ||
        settings.disabled ||
        (!settings.schedule && s.project.status === "done") ||
        (!settings.schedule && !s.project.dueDate)
      )
        state = "disabled";
      else if (settings.weekly && !settings.schedule)
        state = "manual-recurring";
      else {
        const due = settings.schedule
          ? resolveCardSchedule(settings.schedule, s.project.dueDate)
          : zonedTime(
              s.project.dueDate,
              settings.time || p.defaultTime,
              p.timezone,
            );
        if (due !== null) {
          const at = settings.schedule
            ? due
            : due - reminderLead(settings, p) * 60000;
          if (at >= enabledAt && now() - at < 86400000)
            reminderAt = afterQuiet(p, Math.max(now(), at));
        }
        state =
          reminderAt === null
            ? "outside-window"
            : !schedule.hasDevice
              ? "awaiting-device"
              : schedule.nextCheckAt === null
                ? "incomplete"
                : "scheduled";
      }
    }
    return {
      taskId: id,
      revision: s.record.revision,
      projectId: s.task.reminderProjectId,
      status: state,
      verified: !["pending", "blocked", "incomplete"].includes(state),
      scheduled: state === "scheduled",
      ...(s.intent?.reason ? { reason: s.intent.reason } : {}),
      reminderAt,
      nextCheckAt: schedule.nextCheckAt,
      timezone: p.timezone,
      leadMinutes: reminderLead(settings || {}, p),
      schedule: settings?.schedule || null,
      settingsVersion: settings ? await sha256(stableJson(settings)) : null,
      settings: validSettings
        ? {
            disabled: settings.disabled,
            weekly: settings.weekly,
            time: settings.time,
          }
        : null,
    };
  }
  async function block(id, generation, reason) {
    await repository.transact(async (tx) => {
      const i = await tx.getMeta(intentKey(id));
      if (i?.generation === generation && i.state === "pending")
        tx.setMeta(intentKey(id), {
          ...i,
          state: "blocked",
          pending: false,
          reason,
        });
    });
    await reminders.complete(id);
  }
  async function resume(id) {
    const s = await repository.transact((tx) => snapshot(tx, id)),
      i = s.intent;
    if (i?.state !== "pending") {
      if (i?.state === "complete") {
        await reminders.wake();
        await reminders.complete(id);
      } else if (i?.state === "blocked") await reminders.complete(id);
      return;
    }
    const { value: p } = await reminders.preferences();
    if ((await preferencesHash(p, !!i.schedule)) !== i.preferencesHash) {
      await block(id, i.generation, "reminder-preferences-changed");
      return;
    }
    const claimed = await reminders.claim(i.projectId, {
      disabled: false,
      weekly: false,
      time: i.time,
      apiReminderIntent: i.generation,
      ...(i.leadMinutes !== undefined ? { leadMinutes: i.leadMinutes } : {}),
      ...(i.schedule ? { schedule: i.schedule } : {}),
    });
    if (
      claimed?.apiReminderIntent !== i.generation ||
      (i.schedule
        ? stableJson(claimed.schedule) !== stableJson(i.schedule)
        : reminderLead(claimed, p) !== (i.leadMinutes ?? p.leadMinutes))
    ) {
      await block(id, i.generation, "reminder-settings-changed");
      return;
    }
    // The insert above never overwrites manual settings, even when recovering after a timeout.
    await repository.transact(async (tx) => {
      const current = await snapshot(tx, id),
        intent = current.intent;
      if (intent?.state !== "pending" || intent.generation !== i.generation)
        return;
      if (
        current.task.reminderProjectId !== i.projectId ||
        current.record.revision !== i.taskRevision ||
        current.project.revision !== i.projectRevision ||
        current.project.mutationId !== i.generation
      ) {
        tx.setMeta(intentKey(id), {
          ...intent,
          state: "blocked",
          pending: false,
          reason: "reminder-record-changed",
        });
        return;
      }
      const project = ProjectEntity.restore({
        ...current.project,
        id: i.projectId,
      })
        .apply(
          "edit",
          { dueDate: i.date, status: current.task.done ? "done" : "active" },
          i.projectRevision,
          now(),
        )
        .snapshot();
      tx.setProject(i.projectId, { ...project, mutationId: uuid() });
      tx.setMeta(intentKey(id), {
        ...intent,
        state: "complete",
        pending: false,
        expiresAt: new Date(now() + 30 * 86400000),
      });
    });
    // Publish into the SAME scope wake/queue mechanism used by the UI.
    await reminders.wake();
    await reminders.complete(id);
  }
  async function link(id, body, idempotencyKey) {
    object(
      body,
      ["expectedRevision", "leadMinutes", "schedule"],
      ["expectedRevision"],
    );
    if (body.schedule !== undefined && body.leadMinutes !== undefined)
      fail("invalid-input");
    if (
      body.leadMinutes !== undefined &&
      !validLeadMinutes(body.leadMinutes)
    )
      fail("invalid-input");
    if (
      !Number.isSafeInteger(body.expectedRevision) ||
      body.expectedRevision < 0
    )
      fail("invalid-input");
    const fingerprint = await sha256(
        stableJson({
          method: "POST",
          path: "/api/v1/tasks/" + id + "/reminder",
          body,
        }),
      ),
      receiptKey = "receipt_" + (await sha256(idempotencyKey)),
      projectId = (await sha256(ownerUid + "|university-reminder|" + id)).slice(
        0,
        20,
      );
    const { value: p } = await reminders.preferences(),
      prefsHash = await preferencesHash(p, body.schedule !== undefined),
      generation = uuid();
    // Only an owned, valid task may allocate a recovery hint. Invalid IDs must
    // not fill the recovery queue. Recheck the snapshot inside the write transaction.
    await repository.transact((tx) => snapshot(tx, id));
    // Durable hint precedes Firestore. A crash cannot strand a committed outbox.
    await reminders.enqueue(id);
    await repository.transact(async (tx) => {
      const receipt = await tx.getMeta(receiptKey);
      if (receipt) {
        if (
          receipt.fingerprint !== fingerprint ||
          receipt.taskId !== id ||
          !receipt.reminderLink
        )
          fail("idempotency-key-reused");
        return;
      }
      const s = await snapshot(tx, id);
      if (s.task.reminderProjectId && body.schedule !== undefined) {
        const settings = await reminders.read(s.task.reminderProjectId);
        let expected;
        try {
          expected = normalizeCardSchedule(body.schedule, {
            ...p,
            time: settings?.time || p.defaultTime,
          });
        } catch {
          fail("invalid-input");
        }
        if (stableJson(settings?.schedule) !== stableJson(expected))
          fail("reminder-settings-conflict");
      }
      if (s.task.reminderProjectId && body.leadMinutes !== undefined) {
        const settings = await reminders.read(s.task.reminderProjectId);
        if (reminderLead(settings || {}, p) !== body.leadMinutes)
          fail("reminder-settings-conflict");
      }
      if (!s.task.reminderProjectId) {
        if (s.record.revision !== body.expectedRevision)
          fail("revision-conflict");
        if (!p.enabled || (!body.schedule && !p.due))
          fail("reminder-preferences-disabled");
        if (
          (!body.schedule && s.task.done) ||
          (!body.schedule && !s.task.due) ||
          (!body.schedule &&
            (!Number.isFinite(Date.parse(s.task.due)) ||
              Date.parse(s.task.due) <= now()))
        )
          fail("task-not-remindable");
        const collision = await tx.getProject(projectId);
        if (collision) fail("reminder-link-conflict");
        const local = s.task.due
          ? localParts(Date.parse(s.task.due), p.timezone)
          : { date: "", time: p.defaultTime };
        let explicit;
        try {
          if (body.schedule)
            explicit = normalizeCardSchedule(body.schedule, {
              ...p,
              time: local.time,
            });
        } catch {
          fail("invalid-input");
        }
        const dueAt = zonedTime(local.date, local.time, p.timezone);
        if (
          explicit
            ? resolveCardSchedule(explicit, local.date) === null ||
              resolveCardSchedule(explicit, local.date) <= now()
            : dueAt === null ||
              dueAt - (body.leadMinutes ?? p.leadMinutes) * 60000 <= now()
        )
          fail("reminder-time-in-past");
        let project;
        try {
          const fields = reminderCardFields(s.task, undefined, now());
          project = ProjectEntity.create(
            projectId,
            fields.name,
            fields.nextStep,
            fields.rank,
            { ...fields, status: "done" },
            now(),
          ).snapshot();
        } catch {
          fail("invalid-input");
        }
        const task = { ...s.task, reminderProjectId: projectId },
          revision = s.record.revision + 1;
        tx.setStudy("tasks_" + id, {
          ...s.record,
          payload: JSON.stringify(task),
          revision,
          mutationId: generation,
        });
        tx.setProject(projectId, { ...project, mutationId: generation });
        tx.setMeta(intentKey(id), {
          kind: "reminder-outbox",
          taskId: id,
          projectId,
          generation,
          taskRevision: revision,
          projectRevision: 0,
          preferencesHash: prefsHash,
          time: local.time,
          ...(body.leadMinutes !== undefined
            ? { leadMinutes: body.leadMinutes }
            : {}),
          ...(explicit ? { schedule: explicit } : {}),
          date: local.date,
          state: "pending",
          pending: true,
        });
      }
      tx.setMeta(receiptKey, {
        kind: "receipt",
        fingerprint,
        taskId: id,
        reminderLink: true,
        expiresAt: new Date(now() + 30 * 86400000),
      });
    });
    try {
      await resume(id);
      // Even an already-linked/manual reminder only gets a wake, never settings or card rewrites.
      await reminders.wake();
      const result = await status(id);
      if (result.status !== "pending") await reminders.complete(id);
      return result;
    } catch (e) {
      if (
        e instanceof ApiError &&
        [
          "account-unavailable",
          "resource-not-found",
          "reminder-link-conflict",
        ].includes(e.code)
      )
        throw e;
      return {
        taskId: id,
        status: "pending",
        verified: false,
        scheduled: false,
      };
    }
  }
  return { status, link, resume };
}

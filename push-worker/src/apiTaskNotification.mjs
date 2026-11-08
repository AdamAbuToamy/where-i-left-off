import { ApiError, object, validId } from "../../shared/universityApiPlan.mjs";
import { hydrateStudy } from "./apiStudyService.mjs";
import { sha256, stableJson } from "../../shared/apiHash.mjs";
import { quietNow } from "../policy.mjs";
import { afterQuiet } from "../schedule.mjs";
export async function ownedNotificationTask(
  repository,
  id,
  resource = "tasks",
) {
  if (!validId(id)) throw new ApiError("invalid-input");
  return repository.transact(async (tx) => {
    if (resource === "projects") {
      const project = await tx.getProject(id);
      if (!project || project.archivedAt || project.trashedAt)
        throw new ApiError("resource-not-found");
      if (!Number.isSafeInteger(project.revision))
        throw new ApiError("invalid-stored-record");
      return {
        task: { ...project, id, title: project.name, courseId: null },
        revision: project.revision,
      };
    }
    const { data, records } = hydrateStudy(await tx.listStudy());
    const task = data.study.tasks.find((t) => t.id === id);
    if (!task || !data.study.courses.some((c) => c.id === task.courseId))
      throw new ApiError("resource-not-found");
    return { task, revision: records.get("tasks_" + id).revision };
  });
}
/** No arbitrary message payload, credentials, devices or destination UID from the client. */
export function createTaskNotificationService({
  repository,
  notifications,
  ownerUid,
  resource = "tasks",
  now = () => Date.now(),
}) {
  if (repository.uid !== ownerUid) throw new ApiError("account-unavailable");
  async function status(id) {
    await ownedNotificationTask(repository, id, resource);
    return notifications.status(id);
  }
  async function request(id, body, key, authorization = {}) {
    object(
      body,
      ["expectedRevision", "bypassQuietHours"],
      ["expectedRevision"],
    );
    if (
      body.bypassQuietHours !== undefined &&
      typeof body.bypassQuietHours !== "boolean"
    )
      throw new ApiError("invalid-input");
    if (
      body.bypassQuietHours === true &&
      authorization.quietHoursOverride !== true
    )
      throw new ApiError("quiet-hours-override-forbidden");
    if (
      !Number.isSafeInteger(body.expectedRevision) ||
      body.expectedRevision < 0
    )
      throw new ApiError("invalid-input");
    const { task, revision } = await ownedNotificationTask(
      repository,
      id,
      resource,
    );
    const existing = await notifications.job(id),
      pref = await notifications.preferences();
    if (!existing) {
      if (revision !== body.expectedRevision)
        throw new ApiError("revision-conflict");
      if (task.done) throw new ApiError("task-not-notifiable");
      if (
        !pref.enabled ||
        !(await notifications.included(
          resource === "projects" ? id : task.reminderProjectId,
        ))
      )
        throw new ApiError("notifications-disabled");
      if (!pref.deviceIds.length)
        throw new ApiError("notification-device-unavailable");
    }
    await notifications.create({
      id,
      keyHash: await sha256(key),
      fingerprint: await sha256(
        stableJson({
          path: "/api/v1/" + resource + "/" + id + "/notification",
          body,
        }),
      ),
      eventId: (await sha256(ownerUid + "|" + resource + "-added|" + id)).slice(
        0,
        32,
      ),
      revision,
      bypassQuietHours: body.bypassQuietHours === true,
      requestingKeyId: authorization.keyId || "",
      deviceIds: pref.deviceIds,
      at: now(),
    });
    try {
      await notifications.enqueue(id);
    } catch {
      /* Durable pending work is retried by the existing cron. */
    }
    return notifications.status(id);
  }
  async function deliver(id) {
    const job = await notifications.claim(id);
    if (!job) return;
    let snapshot;
    try {
      snapshot = await ownedNotificationTask(repository, id, resource);
    } catch (e) {
      if (e instanceof ApiError && e.code === "resource-not-found") {
        await notifications.finish(id, "resource-unavailable");
        return;
      }
      throw e;
    }
    const p = await notifications.preferences();
    const projectId =
      resource === "projects" ? id : snapshot.task.reminderProjectId;
    if (
      !p.enabled ||
      snapshot.task.done ||
      !(await notifications.included(projectId))
    ) {
      await notifications.finish(id, "disabled");
      return;
    }
    if (now() - job.created_at > 86400000) {
      await notifications.finish(id, "expired");
      return;
    }
    if (quietNow(p, now()) && !(await notifications.bypassAllowed(id))) {
      await notifications.defer(id, afterQuiet(p, now()));
      return;
    }
    const text = {
      ar: ["أُضيف واجب جديد", "افتح Wilo للاطلاع على الواجب"],
      en: ["New assignment added", "Open Wilo to view your assignment"],
      he: ["נוספה מטלה חדשה", "פתחו את Wilo לצפייה במטלה"],
    }[p.language];
    const payload = {
      uid: ownerUid,
      title: resource === "tasks" ? text[0] : "Wilo",
      body: p.hideContent
        ? resource === "tasks"
          ? text[1]
          : "Wilo"
        : snapshot.task.title,
      language: p.language,
      url:
        resource === "tasks"
          ? "#/university?courseId=" +
            encodeURIComponent(snapshot.task.courseId)
          : "#/personal/" + id,
      tag: "wilo-task-" + job.event_id,
    };
    for (const deviceId of JSON.parse(job.device_ids)) {
      const current = await notifications.preferences();
      if (!current.enabled || !(await notifications.included(projectId))) {
        await notifications.finish(id, "disabled");
        return;
      }
      if (
        quietNow(current, now()) &&
        !(await notifications.bypassAllowed(id))
      ) {
        await notifications.defer(id, afterQuiet(current, now()));
        return;
      }
      const safePayload = {
        ...payload,
        body: current.hideContent
          ? resource === "tasks"
            ? text[1]
            : "Wilo"
          : snapshot.task.title,
      };
      await notifications.sendOnce(id, deviceId, safePayload);
    }
    await notifications.finish(id);
  }
  return { request, status, deliver };
}

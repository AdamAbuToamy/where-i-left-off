import {
  readReminderCollection,
  mutateReminderCollection,
} from "./cardReminderCollection.mjs";
import { updateApiCardReminder } from "./apiCardReminder.mjs";
import { readReminderView } from "./reminderView.mjs";
import { createTaskNotificationService } from "./apiTaskNotification.mjs";
import { createTaskNotificationStore } from "./apiTaskNotificationStore.mjs";
import { sha256, stableJson } from "../../shared/apiHash.mjs";
import { createTaskReminderService } from "./apiTaskReminder.mjs";
import { createApiReminderStore } from "./apiReminderStore.mjs";
import { ApiError, validId, object } from "../../shared/universityApiPlan.mjs";
import {
  authenticateApi,
  requireScopes,
  allowApiRequest,
} from "./apiSecurity.mjs";
import { auditApi } from "./apiKeys.mjs";
import { assertApiAccount, createApiRepository } from "./apiFirestore.mjs";
import { createApiStudyService } from "./apiStudyService.mjs";
import { readBoundedJson, securityHeaders } from "./httpSecurity.mjs";
import {
  cardKey,
  clock,
  preferences,
  reminderLead,
  reminderLeads,
  zonedTime,
} from "../policy.mjs";
import * as store from "./store.mjs";
const headers = {
  ...securityHeaders,
  "content-type": "application/json",
  "cache-control": "no-store",
  pragma: "no-cache",
  "x-wilo-api-version": "1.5.0",
};
const codes = {
  unauthenticated: 401,
  "insufficient-scope": 403,
  "quiet-hours-override-forbidden": 403,
  "account-unavailable": 403,
  "api-disabled": 503,
  "integration-unconfigured": 503,
  "dependency-unavailable": 503,
  "audit-unavailable": 503,
  "invalid-input": 422,
  "resource-not-found": 404,
  "not-found": 404,
  "invalid-json": 400,
  "request-too-large": 413,
  "account-plan-too-large": 413,
  "rate-limited": 429,
  "revision-conflict": 409,
  "idempotency-key-reused": 409,
  "idempotency-key-required": 400,
  "linked-reminder-use-ui": 409,
  "invalid-stored-record": 409,
  "transaction-conflict": 409,
  "duplicate-resource": 409,
  "unsupported-media-type": 415,
  "https-required": 400,
  "reminder-link-conflict": 409,
  "reminder-preferences-disabled": 409,
  "task-not-remindable": 409,
  "reminder-time-in-past": 409,
  "reminder-settings-conflict": 409,
  "reminder-limit": 429,
  "task-not-notifiable": 409,
  "notifications-disabled": 409,
  "notification-device-unavailable": 409,
  "invalid-reminder-schedule": 422,
  "timezone-offset-mismatch": 422,
};
const resources = {
  courses: "courses",
  tasks: "tasks",
  schedule: "lessons",
  projects: "projects",
  sections: "sections",
  boards: "board",
  reminders: "reminders",
};
export function createApiHandler(overrides = {}) {
  return async (request, env) => {
    const requestId = crypto.randomUUID();
    let identity,
      operation = "unknown";
    try {
      const url = new URL(request.url);
      if (url.protocol !== "https:") throw new ApiError("https-required");
      identity = await authenticateApi(request, env);
      await allowApiRequest(env, identity.uid);
      const collection = url.pathname.match(
        /^\/api\/v1\/projects\/([A-Za-z0-9_-]{1,128})\/reminders(?:\/([A-Za-z0-9_-]{1,128}))?$/,
      );
      if (collection) {
        const read = request.method === "GET",
          method = request.method,
          id = collection[2];
        operation = "card-reminder." + (read ? "read" : method.toLowerCase());
        if (
          url.search ||
          !(
            read ||
            (!id && method === "POST") ||
            (id && ["PATCH", "DELETE"].includes(method))
          )
        )
          throw new ApiError("not-found");
        requireScopes(identity, read ? "reminders:read" : "reminders:write");
        await (overrides.assertAccount || assertApiAccount)(env, identity.uid);
        const repository = (overrides.repository || createApiRepository)(
            env,
            identity.uid,
          ),
          project = await repository.transact((tx) =>
            tx.getProject(collection[1]),
          );
        if (!project || project.archivedAt || project.trashedAt)
          throw new ApiError("resource-not-found");
        const owned = { ...project, id: collection[1] };
        let body;
        if (!read) {
          if (
            request.headers.get("content-type")?.split(";")[0].trim() !==
            "application/json"
          )
            throw new ApiError("unsupported-media-type");
          body = await readBoundedJson(request, 30000);
        }
        await auditApi(
          env,
          identity.uid,
          identity.keyId,
          operation + ".accepted",
          100,
        );
        const result = read
          ? await readReminderCollection(env, identity.uid, owned, "", id)
          : await mutateReminderCollection(
              env,
              identity.uid,
              owned,
              "",
              method,
              id,
              body,
              request.headers.get("idempotency-key"),
            );
        const status = method === "POST" ? 201 : 200;
        await env.DB.prepare(
          "UPDATE user_api_keys SET last_used_at=? WHERE uid=? AND id=?",
        )
          .bind(Date.now(), identity.uid, identity.keyId)
          .run();
        await auditApi(env, identity.uid, identity.keyId, operation, status);
        return new Response(JSON.stringify({ result, requestId }), {
          status,
          headers,
        });
      }
      const taskReminder = url.pathname.match(
        /^\/api\/v1\/tasks\/([A-Za-z0-9_-]{1,128})\/reminder$/,
      );
      if (taskReminder) {
        const read = request.method === "GET";
        operation = "task-reminder." + (read ? "read" : "link");
        if (!["GET", "POST"].includes(request.method) || url.search)
          throw new ApiError("not-found");
        requireScopes(
          identity,
          ...(read
            ? ["tasks:read", "reminders:read"]
            : [
                "courses:read",
                "tasks:read",
                "tasks:write",
                "reminders:read",
                "reminders:write",
              ]),
        );
        await (overrides.assertAccount || assertApiAccount)(env, identity.uid);
        const repository = (overrides.repository || createApiRepository)(
          env,
          identity.uid,
        );
        const reminders = (overrides.reminders || createApiReminderStore)(
          env,
          identity.uid,
        );
        const service = createTaskReminderService({
          repository,
          reminders,
          ownerUid: identity.uid,
          ...overrides.serviceOptions,
        });
        let body, key;
        if (!read) {
          if (
            request.headers.get("content-type")?.split(";")[0].trim() !==
            "application/json"
          )
            throw new ApiError("unsupported-media-type");
          key = request.headers.get("idempotency-key");
          if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]{15,127}$/.test(key || ""))
            throw new ApiError("idempotency-key-required");
          body = await readBoundedJson(request, 30000);
        }
        await auditApi(
          env,
          identity.uid,
          identity.keyId,
          operation + ".accepted",
          100,
        );
        const result = read
          ? await service.status(taskReminder[1])
          : await service.link(taskReminder[1], body, key);
        const status =
          result.status === "pending"
            ? 202
            : result.status === "blocked"
              ? 409
              : 200;
        await env.DB.prepare(
          "UPDATE user_api_keys SET last_used_at=? WHERE id=? AND uid=?",
        )
          .bind(Date.now(), identity.keyId, identity.uid)
          .run();
        await auditApi(env, identity.uid, identity.keyId, operation, status);
        return new Response(JSON.stringify({ result, requestId }), {
          status,
          headers,
        });
      }
      const taskNotification = url.pathname.match(
        /^\/api\/v1\/(tasks|projects)\/([A-Za-z0-9_-]{1,128})\/notification$/,
      );
      if (taskNotification) {
        const resource = taskNotification[1],
          read = request.method === "GET";
        operation = "task-notification." + (read ? "read" : "request");
        if (!["GET", "POST"].includes(request.method) || url.search)
          throw new ApiError("not-found");
        requireScopes(
          identity,
          ...(resource === "projects"
            ? read
              ? ["projects:read", "reminders:read"]
              : ["projects:read", "reminders:write"]
            : read
              ? ["tasks:read", "reminders:read"]
              : ["courses:read", "tasks:read", "reminders:write"]),
        );
        await (overrides.assertAccount || assertApiAccount)(env, identity.uid);
        const repository = (overrides.repository || createApiRepository)(
          env,
          identity.uid,
        );
        const notifications = (
          overrides.notifications || createTaskNotificationStore
        )(env, identity.uid, { resource });
        const service = createTaskNotificationService({
          repository,
          notifications,
          ownerUid: identity.uid,
          resource,
          ...overrides.serviceOptions,
        });
        let body, key;
        if (!read) {
          if (
            request.headers.get("content-type")?.split(";")[0].trim() !==
            "application/json"
          )
            throw new ApiError("unsupported-media-type");
          key = request.headers.get("idempotency-key");
          if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]{15,127}$/.test(key || ""))
            throw new ApiError("idempotency-key-required");
          body = await readBoundedJson(request, 30000);
        }
        if (body?.bypassQuietHours === true) operation += ".quiet-override";
        await auditApi(
          env,
          identity.uid,
          identity.keyId,
          operation + ".accepted",
          100,
        );
        const result = read
          ? await service.status(taskNotification[2])
          : await service.request(taskNotification[2], body, key, {
              keyId: identity.keyId,
              quietHoursOverride: identity.quietHoursOverride,
            });
        const status =
          !read &&
          ["pending", "queued", "deferred", "sending"].includes(result.status)
            ? 202
            : 200;
        await env.DB.prepare(
          "UPDATE user_api_keys SET last_used_at=? WHERE id=? AND uid=?",
        )
          .bind(Date.now(), identity.keyId, identity.uid)
          .run();
        await auditApi(env, identity.uid, identity.keyId, operation, status);
        return new Response(JSON.stringify({ result, requestId }), {
          status,
          headers,
        });
      }
      const match = url.pathname.match(
        /^\/api\/v1\/(courses|tasks|schedule|projects|sections|boards|reminders)(?:\/([A-Za-z0-9_-]{1,128}))?$/,
      );
      if (!match) throw new ApiError("not-found");
      const [, resource, id] = match,
        kind = resources[resource],
        method = request.method,
        read = method === "GET";
      operation =
        resource +
        "." +
        (read ? "read" : method === "POST" ? "create" : "update");
      requireScopes(identity, resource + ":" + (read ? "read" : "write"));
      if (
        !["GET", "POST", "PATCH", "PUT", "DELETE"].includes(method) ||
        (read && id && resource !== "boards" && resource !== "reminders") ||
        (resource === "boards" &&
          (id !== "personal" || !["GET", "PUT"].includes(method))) ||
        (resource === "reminders" &&
          (!id || !["GET", "PUT", "DELETE"].includes(method))) ||
        (!["boards", "reminders"].includes(resource) &&
          !read &&
          (method === "POST" ? !!id : method !== "PATCH" || !id))
      )
        throw new ApiError("not-found");
      const query = { limit: 100 };
      for (const [k, v] of url.searchParams) {
        if (
          !["limit", "cursor", "courseId"].includes(k) ||
          url.searchParams.getAll(k).length !== 1 ||
          !read ||
          ["boards", "reminders"].includes(resource)
        )
          throw new ApiError("invalid-input");
        if (k === "limit") {
          if (!/^\d{1,3}$/.test(v) || +v < 1 || +v > 100)
            throw new ApiError("invalid-input");
          query.limit = +v;
        } else {
          if (
            !validId(v) ||
            (k === "courseId" && !["tasks", "schedule"].includes(resource))
          )
            throw new ApiError("invalid-input");
          query[k] = v;
        }
      }
      await (overrides.assertAccount || assertApiAccount)(env, identity.uid);
      const repository = (overrides.repository || createApiRepository)(
        env,
        identity.uid,
      );
      const service = createApiStudyService({
        repository,
        ownerUid: identity.uid,
        ...overrides.serviceOptions,
      });
      let body;
      if (!read) {
        if (
          method !== "DELETE" &&
          request.headers.get("content-type")?.split(";")[0].trim() !==
            "application/json"
        )
          throw new ApiError("unsupported-media-type");
        body =
          method === "DELETE"
            ? {
                disabled: true,
                expectedSettingsVersion: (
                  request.headers.get("if-match") || ""
                ).replace(/^"|"$/g, ""),
              }
            : await readBoundedJson(request, kind === "board" ? 200000 : 30000);
      }
      // Audit acceptance before a write. A failed audit store fails closed.
      await auditApi(
        env,
        identity.uid,
        identity.keyId,
        operation + ".accepted",
        100,
      );
      let result;
      if (resource === "reminders") {
        const project = await repository.transact((tx) => tx.getProject(id));
        if (!project || project.trashedAt || project.archivedAt)
          throw new ApiError("resource-not-found");
        result = read
          ? await readReminderView(env, identity.uid, { ...project, id })
          : {
              id,
              updated: true,
              ...(await updateApiCardReminder(
                env,
                identity.uid,
                { ...project, id },
                body,
                request.headers.get("idempotency-key"),
                url.pathname,
                method,
              )),
            };
      } else if (read) result = await service.read(kind, query);
      else {
        const key = request.headers.get("idempotency-key");
        if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]{15,127}$/.test(key || ""))
          throw new ApiError("idempotency-key-required");
        result = await service.mutate({
          kind,
          id,
          method,
          body,
          idempotencyKey: key,
          path: url.pathname,
        });
        if (kind === "projects") await store.wake(env, identity.uid);
      }
      await env.DB.prepare(
        "UPDATE user_api_keys SET last_used_at=? WHERE id=? AND uid=?",
      )
        .bind(Date.now(), identity.keyId, identity.uid)
        .run();
      const status = result.created ? 201 : 200;
      await auditApi(env, identity.uid, identity.keyId, operation, status);
      return new Response(JSON.stringify({ result, requestId }), {
        status,
        headers,
      });
    } catch (e) {
      const code =
          e instanceof ApiError
            ? e.code
            : e.message === "invalid-size"
              ? "request-too-large"
              : e.message === "invalid-json"
                ? "invalid-json"
                : "dependency-unavailable",
        status = codes[code] || 503;
      if (identity)
        try {
          await auditApi(env, identity.uid, identity.keyId, operation, status);
        } catch {
          /* Response never includes audit payload or credentials. */
        }
      return new Response(JSON.stringify({ error: code, requestId }), {
        status,
        headers: {
          ...headers,
          ...(status === 401
            ? { "www-authenticate": 'Bearer realm="wilo-api"' }
            : {}),
          ...([429, 503].includes(status)
            ? { "retry-after": status === 429 ? "60" : "2" }
            : {}),
        },
      });
    }
  };
}

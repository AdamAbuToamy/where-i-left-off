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
import { cardKey, clock, preferences } from "../policy.mjs";
import * as store from "./store.mjs";
const headers = {
  ...securityHeaders,
  "content-type": "application/json",
  "cache-control": "no-store",
  pragma: "no-cache",
};
const codes = {
  unauthenticated: 401,
  "insufficient-scope": 403,
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
        !["GET", "POST", "PATCH", "PUT"].includes(method) ||
        (read && id && resource !== "boards" && resource !== "reminders") ||
        (resource === "boards" &&
          (id !== "personal" || !["GET", "PUT"].includes(method))) ||
        (resource === "reminders" &&
          (!id || !["GET", "PUT"].includes(method))) ||
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
          request.headers.get("content-type")?.split(";")[0].trim() !==
          "application/json"
        )
          throw new ApiError("unsupported-media-type");
        body = await readBoundedJson(
          request,
          kind === "board" ? 200000 : 30000,
        );
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
        const key = cardKey(id),
          old = await store.card(env, identity.uid, key);
        if (read) {
          const account = await store.account(env, identity.uid);
          const p = preferences(JSON.parse(account.prefs));
          result = {
            projectId: id,
            disabled: old.disabled === true,
            weekly: old.weekly === true,
            time: old.time || "",
            deliveryEnabled: p.enabled,
          };
        } else {
          object(
            body,
            ["disabled", "weekly", "time"],
            ["disabled", "weekly", "time"],
          );
          if (
            typeof body.disabled !== "boolean" ||
            typeof body.weekly !== "boolean" ||
            (body.time !== "" && !clock(body.time))
          )
            throw new ApiError("invalid-input");
          await store.saveCard(env, identity.uid, key, { ...old, ...body });
          await store.wake(env, identity.uid);
          result = { id, updated: true };
        }
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

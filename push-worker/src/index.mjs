import {
  isExplicitLegacyReminder,
  legacyDefaultSuppressed,
} from "../../shared/legacyReminder.mjs";
import { explicitReminderEvent } from "../../shared/cardReminderSchedule.mjs";
import {
  readReminderCollection,
  mutateReminderCollection,
} from "./cardReminderCollection.mjs";
import {
  reminderRows,
  reminderRow,
  recordEvent,
  recordView,
  beginRecord,
  markRecordQueued,
  startRecordDispatch,
  legacyTerminal,
  freezeLegacy,
} from "./cardReminderRecords.mjs";
import { stableJson } from "../../shared/apiHash.mjs";
import { cardReminderUpdate } from "../../shared/cardReminderUpdate.mjs";
import { readReminderView } from "./reminderView.mjs";
import { createTaskNotificationService } from "./apiTaskNotification.mjs";
import { createTaskNotificationStore } from "./apiTaskNotificationStore.mjs";
import { createApiRepository } from "./apiFirestore.mjs";
import { recoverApiReminderLinks } from "./apiReminderRecovery.mjs";
import { manageApiKeys } from "./apiKeys.mjs";
import { ApiError } from "../../shared/universityApiPlan.mjs";
import { createApiHandler } from "./apiEndpoint.mjs";
import {
  readNotifications,
  readThrough,
  recordNotification,
} from "./notificationCenter.mjs";
import {
  ASSISTANT_PROTOCOL,
  assistantFailure,
  assistantHealth,
} from "./assistantEndpoint.mjs";
import { assistant } from "./assistant.mjs";
import {
  defaults,
  preferences,
  clock,
  validSubscription,
  cardKey,
  candidate,
  quietNow,
  localParts,
  validLeadMinutes,
  reminderInstant,
  zonedTime,
} from "../policy.mjs";
import { nextCheck, afterQuiet } from "../schedule.mjs";
import * as firebase from "./firebase.mjs";
import * as store from "./store.mjs";
import { readBoundedJson, securityHeaders } from "./httpSecurity.mjs";
import { accountAssistant } from "./accountAssistant.mjs";
import { sendPush } from "./push.mjs";
const DAY = 86400000;
const knownReasons = new Set([
  "unauthenticated",
  "account-unavailable",
  "reader-auth-failed",
  "wrong-project",
  "database-unavailable",
  "auth-lookup-failed",
  "push-failed",
  "push-crypto-failed",
  "too-many-cards",
  "invalid-subscription",
  "test-unavailable",
  "device-limit",
  "invalid-card",
  "card-unavailable",
  "invalid-reminder",
  "invalid-size",
  "unknown-action",
]);
function diagnostic(error) {
  const reason = knownReasons.has(error?.message)
    ? error.message
    : typeof error?.code === "string" &&
        /^ERR_(JWT|JWS|JWKS|JOSE)_[A-Z_]+$/.test(error.code)
      ? error.code
      : "runtime";
  return {
    reason,
    ...(Number.isInteger(error?.status)
      ? { upstreamStatus: error.status }
      : {}),
    ...(["aud", "iss", "sub", "exp", "iat"].includes(error?.claim)
      ? { claim: error.claim }
      : {}),
  };
}
const hash = async (text) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
const messages = {
  ar: {
    due: "حان موعد مهمتك",
    stale: "بطاقة تنتظر عودتك",
    private: "افتح التطبيق للاطلاع على التذكير",
  },
  en: {
    due: "Your task reminder",
    stale: "A card is waiting for you",
    private: "Open the app to view your reminder",
  },
  he: {
    due: "תזכורת למשימה",
    stale: "כרטיס מחכה לך",
    private: "פתחו את האפליקציה לצפייה בתזכורת",
  },
};
export function createWorker(overrides = {}) {
  const f = { ...firebase, ...overrides },
    send = overrides.sendPush || sendPush;
  const publicApi = createApiHandler(overrides.publicApi || {});
  async function sync(env, identity, data) {
    const row = await store.account(env, identity.uid);
    await env.DB.prepare("UPDATE scopes SET next_at=?,lease=0 WHERE uid=?")
      .bind(Date.now(), identity.uid)
      .run();
    if (Date.now() - row.last_sync < 5000) return;
    await env.DB.prepare("UPDATE accounts SET last_sync=? WHERE uid=?")
      .bind(Date.now(), identity.uid)
      .run();
    const groups = await f.readCollection(
      env,
      `users/${identity.uid}/groupMemberships`,
      identity.token,
    );
    await store.wake(env, identity.uid);
    for (const group of groups) await store.wake(env, identity.uid, group.id);
    // A member editing a shared card can wake its assignee's existing schedule.
    // Read permission is checked by Firestore with the caller's own token.
    for (const ref of (Array.isArray(data.cards) ? data.cards : []).slice(
      0,
      8,
    )) {
      if (
        !/^[A-Za-z0-9]{20}$/.test(ref.groupId) ||
        !/^[A-Za-z0-9]{20}$/.test(ref.projectId)
      )
        continue;
      const project = await f.readDocument(
        env,
        `groups/${ref.groupId}/projects/${ref.projectId}`,
        identity.token,
      );
      if (project?.assignedTo && project.assignedTo !== identity.uid)
        await store.wake(env, project.assignedTo, ref.groupId);
    }
  }
  async function action(env, identity, data) {
    const { uid } = identity;
    if (data.action === "erase") {
      await store.erase(env, uid);
      return { ok: true };
    }
    await f.accountAvailable(env, uid);
    await store.ensureAccount(env, uid, defaults);
    let row = await store.account(env, uid);
    if (data.action === "notifications")
      return readNotifications(env, identity);
    if (data.action === "notifications-read")
      return readThrough(env, identity, data.through);
    if (
      [
        "reminders-list",
        "reminder-create",
        "reminder-update",
        "reminder-delete",
      ].includes(data.action)
    ) {
      const group = data.groupId || "",
        project = {
          ...(await f.cardDocument(
            env,
            uid,
            data.projectId,
            group,
            identity.token,
          )),
          id: data.projectId,
        };
      if (project.archivedAt || project.trashedAt)
        throw new ApiError("resource-not-found");
      if (data.action === "reminders-list")
        return readReminderCollection(env, uid, project, group);
      const method = {
        "reminder-create": "POST",
        "reminder-update": "PATCH",
        "reminder-delete": "DELETE",
      }[data.action];
      await mutateReminderCollection(
        env,
        uid,
        project,
        group,
        method,
        data.reminderId,
        data.body || {},
        data.requestId,
      );
      return readReminderCollection(env, uid, project, group);
    }
    if (data.action === "get") {
      const cards = await env.DB.prepare(
        "SELECT id,settings FROM cards WHERE uid=?",
      )
        .bind(uid)
        .all();
      return {
        preferences: preferences(JSON.parse(row.prefs)),
        publicKey: env.VAPID_PUBLIC_KEY,
        cards: Object.fromEntries(
          cards.results.map((c) => [c.id, JSON.parse(c.settings)]),
        ),
        settingsVersions: Object.fromEntries(
          await Promise.all(
            cards.results.map(async (c) => [
              c.id,
              await hash(stableJson(JSON.parse(c.settings))),
            ]),
          ),
        ),
      };
    }
    if (data.action === "save") {
      const p = preferences(data.preferences),
        at = p.enabled && !row.enabled ? Date.now() : row.enabled_at;
      await env.DB.prepare(
        "UPDATE accounts SET prefs=?,enabled=?,enabled_at=? WHERE uid=?",
      )
        .bind(JSON.stringify(p), p.enabled ? 1 : 0, at, uid)
        .run();
      await store.wake(env, uid);
      await env.DB.prepare("UPDATE scopes SET next_at=? WHERE uid=?")
        .bind(Date.now(), uid)
        .run();
      if (p.enabled) await sync(env, identity, {});
    } else if (data.action === "sync") {
      await sync(env, identity, data);
    } else if (["subscribe", "unsubscribe", "test"].includes(data.action)) {
      if (!validSubscription(data.subscription))
        throw new Error("invalid-subscription");
      const id = await hash(data.subscription.endpoint);
      if (data.action === "subscribe") {
        const count = await env.DB.prepare(
          "SELECT COUNT(*) AS n FROM devices WHERE uid=? AND id<>?",
        )
          .bind(uid, id)
          .first();
        if (count.n >= 5) throw new Error("device-limit");
        await env.DB.prepare(
          "INSERT INTO devices(id,uid,subscription) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET uid=excluded.uid,subscription=excluded.subscription",
        )
          .bind(
            id,
            uid,
            JSON.stringify({
              endpoint: data.subscription.endpoint,
              keys: data.subscription.keys,
            }),
          )
          .run();
        await store.wake(env, uid);
      } else if (data.action === "unsubscribe")
        await env.DB.prepare("DELETE FROM devices WHERE id=? AND uid=?")
          .bind(id, uid)
          .run();
      else {
        const claimed = await env.DB.prepare(
          "UPDATE devices SET last_test=? WHERE id=? AND uid=? AND last_test<? RETURNING id",
        )
          .bind(Date.now(), id, uid, Date.now() - 60000)
          .all();
        if (!claimed.results.length) throw new Error("test-unavailable");
        await env.PUSH_QUEUE.send({
          type: "test",
          uid,
          deviceId: id,
          createdAt: Date.now(),
        });
        return {
          ok: true,
          status: "queued",
          target: "this-device",
          handsetDelivery: "not-confirmed",
        };
      }
    } else if (
      data.action === "card" ||
      data.action === "viewed" ||
      data.action === "card-status"
    ) {
      const groupId = data.groupId || "",
        id = cardKey(data.projectId, groupId);
      const project = await f.cardDocument(
        env,
        uid,
        data.projectId,
        groupId,
        identity.token,
      );
      const card = await store.card(env, uid, id);
      if (data.action === "card-status")
        return readReminderView(
          env,
          uid,
          { ...project, id: data.projectId },
          groupId,
        );
      if (data.action === "viewed") {
        if (row.enabled && Date.now() - (card.lastViewedAt || 0) > 3600000) {
          card.lastViewedAt = Date.now();
          await store.saveCard(env, uid, id, card);
        }
      } else {
        if (
          ![
            "disabled",
            "weekly",
            "time",
            "schedule",
            "leadMinutes",
            "remindAt",
          ].some((key) => data[key] !== undefined) ||
          (data.disabled !== undefined && typeof data.disabled !== "boolean") ||
          (data.weekly !== undefined && typeof data.weekly !== "boolean") ||
          (data.time !== undefined && data.time !== "" && !clock(data.time))
        )
          throw new Error("invalid-reminder");
        const next = cardReminderUpdate(
          card,
          data,
          project,
          preferences(JSON.parse(row.prefs)),
          Date.now(),
        );
        if (data.settingsVersion !== undefined) {
          const raw = await env.DB.prepare(
            "SELECT settings FROM cards WHERE uid=? AND id=?",
          )
            .bind(uid, id)
            .first();
          if (data.settingsVersion !== (await hash(stableJson(card))))
            throw new Error("reminder-settings-conflict");
          const changed = raw
            ? await env.DB.prepare(
                "UPDATE cards SET settings=? WHERE uid=? AND id=? AND settings=?",
              )
                .bind(JSON.stringify(next), uid, id, raw.settings)
                .run()
            : await env.DB.prepare(
                "INSERT INTO cards(uid,id,settings) VALUES(?,?,?) ON CONFLICT(uid,id) DO NOTHING",
              )
                .bind(uid, id, JSON.stringify(next))
                .run();
          if (!changed.meta.changes)
            throw new Error("reminder-settings-conflict");
        } else if (
          data.schedule !== undefined ||
          data.leadMinutes !== undefined ||
          data.remindAt !== undefined
        ) {
          if (Object.keys(card).length)
            throw new Error("reminder-settings-conflict");
          const changed = await env.DB.prepare(
            "INSERT INTO cards(uid,id,settings) VALUES(?,?,?) ON CONFLICT(uid,id) DO NOTHING",
          )
            .bind(uid, id, JSON.stringify(next))
            .run();
          if (!changed.meta.changes)
            throw new Error("reminder-settings-conflict");
        } else await store.saveCard(env, uid, id, next);
      }
      await store.wake(env, uid, groupId);
      if (data.action === "card")
        return {
          ok: true,
          ...(await readReminderView(
            env,
            uid,
            { ...project, id: data.projectId },
            groupId,
          )),
        };
    } else throw new Error("unknown-action");
    return { ok: true };
  }
  async function plan(env, { uid, scope = "", lease }) {
    const row = await store.account(env, uid);
    if (!row?.enabled) return;
    const p = preferences(JSON.parse(row.prefs)),
      now = Date.now();
    if (quietNow(p, now)) {
      await env.DB.prepare(
        "UPDATE scopes SET next_at=?,lease=0 WHERE uid=? AND scope=? AND lease=?",
      )
        .bind(afterQuiet(p, now), uid, scope, lease)
        .run();
      return;
    }
    await f.accountAvailable(env, uid);
    const projects = await f.scopeProjects(env, uid, scope);
    const devices = (
      await env.DB.prepare("SELECT id FROM devices WHERE uid=?").bind(uid).all()
    ).results;
    if (!devices.length) {
      await env.DB.prepare(
        "UPDATE scopes SET next_at=?,lease=0 WHERE uid=? AND scope=? AND lease=?",
      )
        .bind(now + DAY, uid, scope, lease)
        .run();
      return;
    }
    const events = (
      await env.DB.prepare("SELECT id,type,event_key FROM events WHERE uid=?")
        .bind(uid)
        .all()
    ).results;
    const previous = new Map(
      events.map((e) => [e.id + "/" + e.type, e.event_key]),
    );
    let queued = 0;
    const stored = (
      await env.DB.prepare("SELECT id,settings FROM cards WHERE uid=?")
        .bind(uid)
        .all()
    ).results;
    const cards = new Map(stored.map((c) => [c.id, JSON.parse(c.settings)]));
    let next = now + DAY,
      lastStaleDate = row.last_stale_date;
    for (const project of projects) {
      const id = cardKey(project.id, scope),
        card = cards.get(id) || {};
      const independent = await reminderRows(env, uid, id);
      for (const reminder of independent) {
        if (
          reminder.state !== "active" ||
          card.disabled ||
          project.archivedAt ||
          project.trashedAt
        )
          continue;
        const plan = recordEvent(reminder, project);
        if (!plan) continue;
        const view = await recordView(
          env,
          uid,
          id,
          reminder,
          project,
          p,
          card,
          now,
        );
        if (
          [
            "provider-accepted",
            "partially-accepted",
            "failed",
            "unknown",
            "expired",
            "cancelled",
          ].includes(view.status)
        )
          continue;
        if (plan.at > now) {
          next = Math.min(next, afterQuiet(p, plan.at));
          continue;
        }
        if (now - plan.at >= DAY) continue;
        next = Math.min(next, now + 60000);
        if (queued >= 8 || now - reminder.queued_at < 120000) continue;
        const target = reminder.queued_at
          ? JSON.parse(reminder.device_ids)
          : devices.map((d) => d.id);
        if (
          !(await beginRecord(
            env,
            uid,
            id,
            reminder.id,
            reminder.revision,
            plan.event,
            plan.at,
            target,
          ))
        )
          continue;
        await env.PUSH_QUEUE.sendBatch(
          target.map((deviceId) => ({
            body: {
              type: "deliver",
              uid,
              scope,
              projectId: project.id,
              deviceId,
              event: plan.event,
              reminderId: reminder.id,
              reminderRevision: reminder.revision,
              createdAt: now,
            },
          })),
        );
        await markRecordQueued(env, uid, id, reminder.id, reminder.revision);
        queued++;
      }
      const terminal = await legacyTerminal(env, uid, id, card);
      if (
        (terminal && (card.schedule || card.remindAt)) ||
        card.legacyCancelled ||
        legacyDefaultSuppressed(card, independent.length)
      )
        continue;
      if (
        scope &&
        project.assignedTo !== uid &&
        !isExplicitLegacyReminder(card)
      )
        continue;
      const legacyPreferences = terminal ? { ...p, due: false } : p;
      const event = candidate(
        project,
        card,
        legacyPreferences,
        now,
        row.enabled_at,
      );
      let consumed =
        !!event && previous.get(id + "/" + event.type) === event.key;
      if (event && !consumed && queued >= 8) {
        next = Math.min(next, now + 60000);
        continue;
      }
      if (
        event &&
        !consumed &&
        devices.length &&
        !(
          event.type === "stale" &&
          lastStaleDate === localParts(now, p.timezone).date
        )
      ) {
        consumed = await store.claimEvent(env, uid, id, event.type, event.key);
        if (consumed) {
          queued++;
          if (event.type === "stale") {
            const day = localParts(now, p.timezone).date;
            const claim = await env.DB.prepare(
              "UPDATE accounts SET last_stale_date=? WHERE uid=? AND last_stale_date<>? RETURNING uid",
            )
              .bind(day, uid, day)
              .all();
            if (!claim.results.length) continue;
            lastStaleDate = day;
            card.lastStaleAt = now;
            await store.saveCard(env, uid, id, card);
          }
          await env.PUSH_QUEUE.sendBatch(
            devices.map((d) => ({
              body: {
                type: "deliver",
                uid,
                scope,
                projectId: project.id,
                deviceId: d.id,
                event,
                createdAt: now,
              },
            })),
          );
        }
        // Even an already claimed event must not create a once-per-minute rescan.
        consumed = true;
      }
      next = Math.min(
        next,
        nextCheck(
          project,
          card,
          legacyPreferences,
          now,
          row.enabled_at,
          consumed,
          lastStaleDate,
        ),
      );
    }
    await env.DB.prepare(
      "UPDATE scopes SET next_at=?,lease=0 WHERE uid=? AND scope=? AND lease=?",
    )
      .bind(next, uid, scope, lease)
      .run();
  }
  async function deliver(env, message) {
    const row = await store.account(env, message.uid);
    if (!row?.enabled || Date.now() - message.createdAt > DAY) {
      console.info("push.delivery.skipped", { reason: "disabled-or-expired" });
      return;
    }
    const device = await env.DB.prepare(
      "SELECT subscription FROM devices WHERE id=? AND uid=?",
    )
      .bind(message.deviceId, message.uid)
      .first();
    if (!device) {
      if (message.reminderId) {
        const ck = cardKey(message.projectId, message.scope),
          r = await reminderRow(env, message.uid, ck, message.reminderId);
        if (
          r?.state === "active" &&
          r.revision === message.reminderRevision &&
          r.event_key === message.event.key
        ) {
          const did = await hash(
            `${message.deviceId}/${ck}/${message.event.key}`,
          );
          if (
            await store.claimReminderDispatch(
              env,
              did,
              message.uid,
              ck,
              message.event.key,
              message.deviceId,
            )
          )
            await store.finishReminderDispatch(env, did, "skipped");
        }
      }
      console.info("push.delivery.skipped", {
        reason: "device-not-registered",
      });
      return;
    }
    await f.accountAvailable(env, message.uid);
    const p = preferences(JSON.parse(row.prefs));
    if (message.type === "test") {
      const text = {
        ar: [
          "الإشعارات مفعّلة",
          "ستصلك التذكيرات التي اخترتها على هذا الهاتف.",
        ],
        en: [
          "Notifications are ready",
          "Your selected reminders will arrive on this phone.",
        ],
        he: ["ההתראות פעילות", "התזכורות שבחרתם יגיעו לטלפון הזה."],
      }[p.language] || [
        "Notifications are ready",
        "Your selected reminders will arrive on this phone.",
      ];
      const payload = {
        uid: message.uid,
        title: text[0],
        body: text[1],
        language: p.language,
        url: "#/settings",
        tag: "wilo-push-test",
      };
      await send(env, JSON.parse(device.subscription), payload);
      try {
        await recordNotification(
          env,
          message.uid,
          "test_" + message.createdAt,
          payload,
        );
      } catch {
        console.warn("push.history.failed", { reason: "storage" });
      }
      return;
    }
    const project = await f.cardDocument(
      env,
      message.uid,
      message.projectId,
      message.scope,
    );
    const key = cardKey(message.projectId, message.scope),
      card = await store.card(env, message.uid, key);
    let selected = null;
    if (message.reminderId) {
      selected = await reminderRow(env, message.uid, key, message.reminderId);
      const event = selected && recordEvent(selected, project);
      if (
        !selected ||
        selected.state !== "active" ||
        selected.revision !== message.reminderRevision ||
        event?.event.key !== message.event.key ||
        Date.now() < event.at ||
        Date.now() - event.at >= DAY
      )
        return;
    } else {
      if (card.legacyCancelled) return;
      const terminal = await legacyTerminal(env, message.uid, key, card);
      if (
        terminal &&
        message.event.type !== "stale" &&
        terminal.event_key !== message.event.key
      )
        return;
      if (
        legacyDefaultSuppressed(
          card,
          (await reminderRows(env, message.uid, key)).length,
        )
      )
        return;
    }
    if (quietNow(p, Date.now())) {
      await env.PUSH_QUEUE.send(message, {
        delaySeconds: Math.max(
          1,
          Math.min(
            86400,
            Math.ceil((afterQuiet(p, Date.now()) - Date.now()) / 1000),
          ),
        ),
      });
      return;
    }
    if (
      (message.event.type !== "scheduled" &&
        !p[message.event.type === "due" ? "due" : "stale"]) ||
      card.disabled ||
      (project.status === "done" && message.event.type !== "scheduled") ||
      project.archivedAt ||
      project.trashedAt
    )
      return;
    if (
      !message.reminderId &&
      ["due", "scheduled"].includes(message.event.type) &&
      candidate(project, card, p, Date.now(), row.enabled_at)?.key !==
        message.event.key
    )
      return;
    if (message.event.type === "stale") {
      const last = Math.max(
        project.activityAt || 0,
        project.updatedAt?.toMillis?.() || 0,
        typeof project.updatedAt === "number" ? project.updatedAt : 0,
        card.lastViewedAt || 0,
        row.enabled_at,
      );
      if (Date.now() - last < p.staleDays * DAY) return;
    }
    if (
      selected &&
      !(await startRecordDispatch(
        env,
        message.uid,
        key,
        selected.id,
        selected.revision,
        message.event,
      ))
    )
      return;
    const deliveryId = await hash(
      `${message.deviceId}/${key}/${message.event.key}`,
    );
    if (
      !(await store.claimReminderDispatch(
        env,
        deliveryId,
        message.uid,
        key,
        message.event.key,
        message.deviceId,
      ))
    )
      return;
    if (!selected)
      await freezeLegacy(
        env,
        message.uid,
        key,
        card,
        message.event,
        explicitReminderEvent(project, card)?.at ??
          (message.event.type === "due"
            ? zonedTime(
                message.event.date,
                card.time || p.defaultTime,
                p.timezone,
              ) -
              (card.leadMinutes ?? p.leadMinutes) * 60000
            : Date.now()),
      );
    const t = messages[p.language];
    const payload = {
      uid: message.uid,
      title: t[message.event.type === "scheduled" ? "due" : message.event.type],
      body: p.hideContent ? t.private : project.name,
      url: message.scope
        ? `#/groups/${message.scope}/${message.projectId}`
        : `#/personal/${message.projectId}`,
      tag: `wilo-${key}-${message.reminderId || message.event.type}`,
    };
    try {
      await send(env, JSON.parse(device.subscription), payload);
      await store.finishReminderDispatch(env, deliveryId, "provider-accepted");
      try {
        await recordNotification(
          env,
          message.uid,
          await hash(`${key}/${message.event.type}/${message.event.key}`),
          payload,
        );
      } catch {
        console.warn("push.history.failed", { reason: "storage" });
      }
    } catch (error) {
      await store.finishReminderDispatch(
        env,
        deliveryId,
        Number.isInteger(error?.status) ? "failed" : "unknown",
      );
      if ([404, 410].includes(error.status))
        await env.DB.prepare("DELETE FROM devices WHERE id=? AND uid=?")
          .bind(message.deviceId, message.uid)
          .run();
      throw error;
    }
  }
  return {
    async fetch(request, env) {
      if (new URL(request.url).pathname.startsWith("/api/v1/"))
        return publicApi(request, env);
      const isAssistant = new URL(request.url).pathname === "/assistant",
        requestId = crypto.randomUUID();
      let stage = "request";
      const origin = request.headers.get("origin"),
        allowed = (env.APP_ORIGINS || "").split(",").includes(origin);
      const headers = {
        ...securityHeaders,
        "content-type": "application/json",
        "cache-control": "no-store",
        vary: "Origin",
      };
      if (!allowed) {
        console.warn("security.http.denied", { reason: "origin", status: 403 });
        return new Response(JSON.stringify({ error: "origin-not-allowed" }), {
          status: 403,
          headers,
        });
      }
      if (isAssistant) {
        headers["x-wilo-assistant-version"] = ASSISTANT_PROTOCOL;
        headers["x-wilo-request-id"] = requestId;
        headers["access-control-expose-headers"] =
          "x-wilo-assistant-version,x-wilo-request-id";
      }
      headers["access-control-allow-origin"] = origin;
      headers["access-control-allow-headers"] =
        "authorization,content-type,x-firebase-appcheck";
      headers["access-control-allow-methods"] = "POST,OPTIONS";
      if (new URL(request.url).pathname === "/moodle")
        return new Response(JSON.stringify({ error: "integration-removed" }), {
          status: 410,
          headers,
        });
      if (request.method === "OPTIONS")
        return new Response(null, { status: 204, headers });
      if (request.method !== "POST")
        return new Response("{}", { status: 405, headers });
      let requestedAction = isAssistant ? "assistant" : "unknown";
      try {
        const data = await readBoundedJson(
          request,
          new URL(request.url).pathname === "/assistant-account"
            ? 500000
            : 65536,
        );
        if (
          !isAssistant &&
          [
            "get",
            "save",
            "subscribe",
            "unsubscribe",
            "test",
            "sync",
            "card",
            "card-status",
            "reminders-list",
            "reminder-create",
            "reminder-update",
            "reminder-delete",
            "viewed",
            "erase",
            "notifications",
            "notifications-read",
          ].includes(data.action)
        )
          requestedAction = data.action;
        stage = "identity";
        const identity = await f.verifyIdentity(request, env);
        let result;
        if (new URL(request.url).pathname === "/account-api-keys") {
          if (identity.emailVerified !== true)
            throw new Error("account-unavailable");
          await f.accountAvailable(env, identity.uid);
          try {
            return new Response(
              JSON.stringify({
                result: await manageApiKeys(env, identity.uid, data),
              }),
              { headers: { ...headers, pragma: "no-cache" } },
            );
          } catch (e) {
            if (!(e instanceof ApiError)) throw e;
            return new Response(JSON.stringify({ error: e.code }), {
              status:
                e.code === "key-not-found"
                  ? 404
                  : e.code === "rate-limited"
                    ? 429
                    : e.code === "api-disabled"
                      ? 503
                      : 422,
              headers,
            });
          }
        }
        if (new URL(request.url).pathname === "/assistant-account") {
          if (identity.emailVerified !== true)
            throw new Error("ai-email-unverified");
          await f.accountAvailable(env, identity.uid);
          await store.ensureAccount(env, identity.uid, defaults);
          return await accountAssistant(
            request,
            env,
            identity.uid,
            data,
            headers,
            overrides.assistantFetch,
          );
        }
        if (isAssistant) {
          stage = "account";
          if (identity.emailVerified !== true)
            throw new Error("ai-email-unverified");
          if (
            env.ASSISTANT_PILOT_EMAIL &&
            identity.email !== env.ASSISTANT_PILOT_EMAIL.toLowerCase()
          )
            throw new Error("account-unavailable");
          await f.accountAvailable(env, identity.uid);
          stage = "database";
          await store.ensureAccount(env, identity.uid, defaults);
          const readiness = await assistantHealth(env);
          stage = "provider";
          result =
            data.mode === "health"
              ? readiness
              : await assistant(env, identity.uid, data);
        } else result = await action(env, identity, data);
        console.info(isAssistant ? "assistant.http" : "push.http", {
          action: requestedAction,
          status: 200,
          ...(isAssistant ? { requestId, protocol: ASSISTANT_PROTOCOL } : {}),
        });
        return new Response(JSON.stringify({ result }), { headers });
      } catch (error) {
        if (isAssistant) {
          const failure = assistantFailure(error, stage, requestId);
          console.warn("assistant.http.failed", {
            status: failure.status,
            ...failure.body.diagnostic,
            code: failure.body.error,
          });
          return new Response(JSON.stringify(failure.body), {
            status: failure.status,
            headers,
          });
        }
        const status =
          error.message === "unauthenticated"
            ? 401
            : error.message === "account-unavailable"
              ? 403
              : [
                    "reminder-settings-conflict",
                    "revision-conflict",
                    "idempotency-key-reused",
                  ].includes(error.message)
                ? 409
                : 400;
        console.warn("push.http.failed", {
          action: requestedAction,
          status,
          ...diagnostic(error),
        });
        return new Response(
          JSON.stringify({
            error:
              status === 401
                ? "unauthenticated"
                : /^ai-[a-z-]+$/.test(error.message)
                  ? error.message
                  : "request-failed",
            ...(error.message === "ai-incomplete-proposal"
              ? { details: error.details }
              : {}),
          }),
          { status, headers },
        );
      }
    },
    async scheduled(_controller, env) {
      if (env.PUBLIC_API_ENABLED === "true")
        try {
          const jobs = await env.DB.prepare(
            "SELECT uid,task_id FROM api_task_notifications WHERE state<>'complete' AND next_at<=? AND lease_until<=? ORDER BY next_at LIMIT 10",
          )
            .bind(Date.now(), Date.now())
            .all();
          for (const job of jobs.results) {
            const resource = job.task_id.startsWith("projects:")
                ? "projects"
                : "tasks",
              id = job.task_id.slice(job.task_id.indexOf(":") + 1);
            await createTaskNotificationStore(env, job.uid, {
              resource,
            }).enqueue(id);
          }
        } catch {
          console.warn("api.task-notification.recovery-pending");
        }
      if (env.PUBLIC_API_ENABLED === "true")
        try {
          await recoverApiReminderLinks(env);
        } catch {
          console.warn("api.reminder.recovery-pending");
        }

      if (env.PUBLIC_API_ENABLED === "true")
        try {
          await env.DB.prepare(
            "DELETE FROM api_audit WHERE id IN (SELECT id FROM api_audit WHERE created_at<? ORDER BY created_at LIMIT 1000)",
          )
            .bind(Date.now() - 30 * DAY)
            .run();
        } catch {
          console.warn("api.audit.cleanup-failed");
        }

      if (env.ASSISTANT_FREE_ONLY === "true")
        try {
          const cutoff = new Date(Date.now() - 7 * DAY)
            .toISOString()
            .slice(0, 10);
          await env.DB.prepare("DELETE FROM ai_usage WHERE day<?")
            .bind(cutoff)
            .run();
          await env.DB.prepare("DELETE FROM ai_budget WHERE day<?")
            .bind(cutoff)
            .run();
        } catch {
          console.warn("assistant.maintenance.failed");
        }
      const now = Date.now(),
        due = await env.DB.prepare(
          "SELECT s.uid,s.scope FROM scopes s JOIN accounts a ON a.uid=s.uid WHERE s.next_at<=? AND s.lease<=? AND a.enabled=1 ORDER BY s.next_at LIMIT 10",
        )
          .bind(now, now)
          .all();
      for (const scope of due.results) {
        const lock = await env.DB.prepare(
          "UPDATE scopes SET lease=? WHERE uid=? AND scope=? AND lease<=? RETURNING uid",
        )
          .bind(now + 120000, scope.uid, scope.scope, now)
          .all();
        if (lock.results.length)
          await env.PUSH_QUEUE.send({
            type: "plan",
            uid: scope.uid,
            scope: scope.scope,
            lease: now + 120000,
          });
      }
      await env.DB.prepare(
        "UPDATE reminder_dispatches SET state='unknown' WHERE state='sending' AND updated_at<?",
      )
        .bind(now - 120000)
        .run();
      await env.DB.prepare("DELETE FROM reminder_dispatches WHERE updated_at<?")
        .bind(now - 7 * DAY)
        .run();
      await env.DB.prepare("DELETE FROM deliveries WHERE created_at<?")
        .bind(now - 7 * DAY)
        .run();
    },
    async queue(batch, env) {
      for (const message of batch.messages) {
        // A previous deployment may have left integration jobs on this shared push queue.
        if (
          !["plan", "deliver", "test", "task-notification"].includes(
            message.body?.type,
          )
        ) {
          message.ack();
          continue;
        }
        try {
          console.info("push.queue.started", {
            type: ["plan", "deliver", "test", "task-notification"].includes(
              message.body.type,
            )
              ? message.body.type
              : "unknown",
          });
          if (message.body.type === "plan") await plan(env, message.body);
          else if (message.body.type === "task-notification") {
            await f.accountAvailable(env, message.body.uid);
            const raw = message.body.taskId,
              resource = raw.startsWith("projects:") ? "projects" : "tasks",
              id = raw.includes(":") ? raw.slice(raw.indexOf(":") + 1) : raw;
            const repository = (
                overrides.publicApi?.repository || createApiRepository
              )(env, message.body.uid),
              notifications = createTaskNotificationStore(
                env,
                message.body.uid,
                { send, resource },
              );
            await createTaskNotificationService({
              repository,
              notifications,
              ownerUid: message.body.uid,
              resource,
            }).deliver(id);
          } else await deliver(env, message.body);
          console.info("push.queue.completed");
          message.ack();
        } catch (error) {
          if (error.message === "account-unavailable") {
            await store.erase(env, message.body.uid);
            message.ack();
          } else if (error.message === "card-unavailable") {
            message.ack();
          } else {
            console.warn("push.queue.failed", diagnostic(error));
            message.retry({
              delaySeconds: error.message === "quiet-retry" ? 3600 : 60,
            });
          }
        }
      }
    },
  };
}
export default createWorker();

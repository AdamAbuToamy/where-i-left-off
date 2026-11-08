import { database } from "./test-db.mjs";
import { readFileSync } from "node:fs";
import { manageApiKeys } from "./src/apiKeys.mjs";
import { createApiHandler } from "./src/apiEndpoint.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { createTaskReminderService } from "./src/apiTaskReminder.mjs";
import { MemoryRepository } from "../tests/helpers/apiMemoryRepository.mjs";
const NOW = Date.parse("2026-11-08T10:00:00Z");
function setup(uid = "alice") {
  const repository = new MemoryRepository(uid),
    settings = new Map(),
    work = new Set();
  let phase = "";
  const course = {
      id: "course",
      name: "Course",
      url: "",
      notes: "",
      requires: [],
      topics: [],
      x: 0,
      y: 0,
    },
    task = {
      id: "task",
      courseId: "course",
      title: "Synthetic task",
      kind: "assignment",
      due: "2026-11-10T12:00:00Z",
      notes: "",
      url: "",
      done: false,
    };
  for (const [kind, item] of [
    ["courses", course],
    ["tasks", task],
  ])
    repository.seed("studyRecords", kind + "_" + item.id, {
      kind,
      id: item.id,
      payload: JSON.stringify(item),
      deleted: false,
      revision: 0,
      mutationId: "seed",
    });
  const p = {
    enabled: true,
    due: true,
    timezone: "Asia/Jerusalem",
    leadMinutes: 15,
    defaultTime: "09:00",
    quiet: false,
    quietStart: "22:00",
    quietEnd: "07:00",
  };
  const reminders = {
    async preferences() {
      return { value: { ...p }, enabledAt: NOW - 86400000 };
    },
    async read(id) {
      return settings.get(id) || null;
    },
    async claim(id, v) {
      if (phase === "before-claim") throw Error("synthetic transient");
      if (!settings.has(id)) settings.set(id, v);
      if (phase === "after-claim") throw Error("synthetic lost ack");
      return settings.get(id);
    },
    async enqueue(id) {
      work.add(id);
    },
    async complete(id) {
      work.delete(id);
    },
    async wake() {
      if (phase === "wake") throw Error("synthetic wake failure");
    },
    async schedule(id) {
      return {
        hasDevice: true,
        nextCheckAt: NOW,
        recoveryPending: work.has(id),
      };
    },
  };
  const service = createTaskReminderService({
    repository,
    reminders,
    ownerUid: uid,
    now: () => NOW,
  });
  return {
    repository,
    reminders,
    settings,
    work,
    p,
    task,
    service,
    setPhase: (v) => (phase = v),
  };
}
const link = (s, key = "synthetic-reminder-key-0001", revision = 0) =>
  s.service.link("task", { expectedRevision: revision }, key);
test("native link is owner scoped, atomic, uses account timezone/lead and verifies registration", async () => {
  const s = setup();
  const r = await link(s);
  assert.equal(r.status, "scheduled");
  assert.equal(r.verified, true);
  assert.equal(r.scheduled, true);
  assert.equal(r.timezone, "Asia/Jerusalem");
  assert.equal(r.reminderAt, Date.parse("2026-11-10T11:45:00Z"));
  const task = JSON.parse(
    s.repository.get("studyRecords", "tasks_task").payload,
  );
  assert.equal(task.reminderProjectId, r.projectId);
  const project = s.repository.get("projects", r.projectId);
  assert.equal(project.resourceType, "course");
  assert.equal(project.dueDate, "2026-11-10");
  assert.equal(s.settings.get(r.projectId).time, "14:00");
  assert.equal(s.work.size, 0);
});
test("same and new operation IDs create exactly one reminder and preserve manual settings", async () => {
  const s = setup();
  const first = await link(s);
  s.settings.set(first.projectId, {
    ...s.settings.get(first.projectId),
    time: "15:25",
    disabled: true,
    weekly: true,
  });
  const replay = await link(s),
    again = await link(s, "synthetic-reminder-key-0002");
  assert.equal(replay.projectId, first.projectId);
  assert.equal(again.status, "disabled");
  assert.equal(s.settings.get(first.projectId).time, "15:25");
  assert.equal(
    [...s.repository.docs.keys()].filter((k) => k.startsWith("projects/"))
      .length,
    1,
  );
});
test("uncertain D1 claim resumes without a second card or settings reset", async () => {
  const s = setup();
  s.setPhase("after-claim");
  const first = await link(s);
  assert.equal(first.status, "pending");
  const stored = JSON.parse(
      s.repository.get("studyRecords", "tasks_task").payload,
    ),
    id = stored.reminderProjectId;
  assert.equal(s.repository.get("projects", id).dueDate, "");
  s.settings.set(id, { ...s.settings.get(id), time: "16:00" });
  s.setPhase("");
  const resumed = await link(s);
  assert.equal(resumed.projectId, id);
  assert.equal(s.settings.get(id).time, "16:00");
  assert.equal(resumed.scheduled, true);
  assert.equal(
    [...s.repository.docs.keys()].filter((k) => k.startsWith("projects/"))
      .length,
    1,
  );
});
test("lost wake is pending until recovery verifies registration", async () => {
  const s = setup();
  s.setPhase("wake");
  assert.equal((await link(s)).status, "pending");
  assert.equal((await s.service.status("task")).status, "pending");
  s.setPhase("");
  await s.service.resume("task");
  assert.equal((await s.service.status("task")).scheduled, true);
});
test("manual Firestore edits or preference changes during pending setup are never overwritten", async () => {
  for (const what of ["project", "task", "preferences"]) {
    const s = setup();
    s.setPhase("before-claim");
    await link(s);
    const task = JSON.parse(
      s.repository.get("studyRecords", "tasks_task").payload,
    );
    if (what === "project") {
      const r = s.repository.get("projects", task.reminderProjectId);
      s.repository.seed("projects", task.reminderProjectId, {
        ...r,
        name: "Manual",
        revision: r.revision + 1,
      });
    }
    if (what === "task") {
      const r = s.repository.get("studyRecords", "tasks_task");
      s.repository.seed("studyRecords", "tasks_task", {
        ...r,
        revision: 2,
        payload: JSON.stringify({ ...task, title: "Manual" }),
      });
    }
    if (what === "preferences") s.p.timezone = "UTC";
    s.setPhase("");
    const r = await link(s);
    assert.equal(r.status, "blocked", what);
    if (what === "project")
      assert.equal(
        s.repository.get("projects", task.reminderProjectId).name,
        "Manual",
      );
  }
});
test("revision, input, account isolation, disabled preferences, missing course and existing card collisions fail closed", async () => {
  const s = setup();
  await assert.rejects(
    link(s, "synthetic-reminder-key-0001", 4),
    /revision-conflict/,
  );
  await assert.rejects(
    s.service.link(
      "task",
      { expectedRevision: 0, time: "invented" },
      "synthetic-reminder-key-0002",
    ),
    /invalid-input/,
  );
  await assert.rejects(
    s.service.status("other-user-task"),
    /resource-not-found/,
  );
  assert.throws(
    () =>
      createTaskReminderService({
        repository: s.repository,
        reminders: s.reminders,
        ownerUid: "bob",
      }),
    /account-unavailable/,
  );
  s.p.enabled = false;
  await assert.rejects(link(s), /reminder-preferences-disabled/);
  assert.equal(
    [...s.repository.docs.keys()].filter((k) => k.startsWith("projects/"))
      .length,
    0,
  );
});
test("concurrent requests serialize to one link and a reused key rejects changed input", async () => {
  const s = setup();
  const [a, b] = await Promise.all([
    link(s),
    link(s, "synthetic-reminder-key-0002"),
  ]);
  assert.equal(a.projectId, b.projectId);
  assert.equal(
    [...s.repository.docs.keys()].filter((k) => k.startsWith("projects/"))
      .length,
    1,
  );
  await assert.rejects(
    link(s, "synthetic-reminder-key-0001", 1),
    /idempotency-key-reused/,
  );
});
test("already-linked UI card settings are read without mutation or enrollment", async () => {
  const s = setup(),
    id = "u".repeat(20),
    r = s.repository.get("studyRecords", "tasks_task");
  s.repository.seed("studyRecords", "tasks_task", {
    ...r,
    payload: JSON.stringify({ ...s.task, reminderProjectId: id }),
  });
  s.repository.seed("projects", id, {
    id,
    name: "Manually named",
    kind: "deadline",
    resourceType: "course",
    status: "active",
    dueDate: "2026-11-10",
    revision: 8,
  });
  s.settings.set(id, { disabled: false, weekly: false, time: "17:10" });
  const result = await link(s);
  assert.equal(result.settings.time, "17:10");
  assert.equal(s.repository.get("projects", id).revision, 8);
  assert.equal(s.repository.get("projects", id).name, "Manually named");
  assert.equal(
    s.repository.get("apiOperations", "university_reminder_task"),
    null,
  );
});

test("HTTP route enforces every scope, denies cross-account IDs and verifies real D1 scheduling", async () => {
  const DB = database();
  for (const file of ["api-schema.sql", "reminder-link-schema.sql"])
    DB.sqlite.exec(readFileSync(new URL("./" + file, import.meta.url), "utf8"));
  const env = { DB, PUBLIC_API_ENABLED: "true" },
    s = setup(),
    repos = { alice: s.repository, bob: new MemoryRepository("bob") };
  const scopes = [
    "courses:read",
    "tasks:read",
    "tasks:write",
    "reminders:read",
    "reminders:write",
  ];
  const issue = (uid, scopes) =>
    manageApiKeys(env, uid, { action: "create", name: "Synthetic", scopes });
  const h = createApiHandler({
    assertAccount: async () => {},
    repository: (_, uid) => repos[uid],
    serviceOptions: { now: () => NOW },
  });
  const request = (key, method = "POST", body = { expectedRevision: 0 }) =>
    new Request("https://api.example/api/v1/tasks/task/reminder", {
      method,
      headers: {
        authorization: "Bearer " + key,
        "content-type": "application/json",
        "idempotency-key": "synthetic-http-link-0001",
      },
      ...(method === "GET" ? {} : { body: JSON.stringify(body) }),
    });
  try {
    for (const scope of scopes) {
      const k = await issue(
        "alice",
        scopes.filter((v) => v !== scope),
      );
      assert.equal((await h(request(k.key), env)).status, 403, scope);
    }
    const owner = await issue("alice", scopes),
      other = await issue("bob", scopes);
    await DB.prepare(
      "UPDATE accounts SET prefs=?,enabled=1,enabled_at=? WHERE uid=?",
    )
      .bind(JSON.stringify(s.p), NOW - 86400000, "alice")
      .run();
    await DB.prepare("INSERT INTO devices(id,uid,subscription) VALUES(?,?,?)")
      .bind("synthetic-device", "alice", "{}")
      .run();
    assert.equal((await h(request(other.key), env)).status, 404);
    assert.equal(
      (
        await DB.prepare(
          "SELECT COUNT(*) AS n FROM api_reminder_work WHERE uid=?",
        )
          .bind("bob")
          .first()
      ).n,
      0,
    );
    const response = await h(request(owner.key), env);
    assert.equal(response.status, 200, await response.clone().text());
    const result = (await response.json()).result;
    assert.equal(result.status, "scheduled");
    assert.equal(result.scheduled, true);
    const card = await DB.prepare("SELECT settings FROM cards WHERE uid=?")
      .bind("alice")
      .first();
    assert.equal(JSON.parse(card.settings).time, "14:00");
    const read = await h(request(owner.key, "GET"), env);
    assert.equal(read.status, 200);
    assert.equal((await read.json()).result.projectId, result.projectId);
    const replay = await h(request(owner.key), env);
    assert.equal((await replay.json()).result.projectId, result.projectId);
    assert.equal(
      (
        await DB.prepare("SELECT COUNT(*) AS n FROM cards WHERE uid=?")
          .bind("alice")
          .first()
      ).n,
      1,
    );
  } finally {
    DB.sqlite.close();
  }
});

for (const leadMinutes of [4320, 5760])
  test(`per-assignment ${leadMinutes} minute lead reaches the native scheduler without changing account defaults`, async () => {
    const s = setup();
    s.task.due = "2026-11-20T12:00:00Z";
    const rec = s.repository.get("studyRecords", "tasks_task");
    s.repository.seed("studyRecords", "tasks_task", {
      ...rec,
      payload: JSON.stringify(s.task),
    });
    const result = await s.service.link(
      "task",
      { expectedRevision: 0, leadMinutes },
      "long-reminder-lead-0001",
    );
    assert.equal(result.leadMinutes, leadMinutes);
    assert.equal(result.scheduled, true);
    assert.equal(
      result.reminderAt,
      Date.parse(s.task.due) - leadMinutes * 60000,
    );
    assert.equal(s.p.leadMinutes, 15);
    const { candidate } = await import("./policy.mjs"),
      { nextCheck } = await import("./schedule.mjs");
    const card = s.settings.get(result.projectId),
      project = s.repository.get("projects", result.projectId);
    assert.equal(
      candidate(project, card, s.p, result.reminderAt, NOW - 86400000).key,
      `due:2026-11-20:14:00:${leadMinutes}`,
    );
    assert.equal(
      candidate(project, {}, s.p, result.reminderAt, NOW - 86400000),
      null,
    );
    assert.equal(
      nextCheck(project, card, s.p, result.reminderAt - 1000, NOW - 86400000),
      result.reminderAt,
    );
    const retry = await s.service.link(
      "task",
      { expectedRevision: 0, leadMinutes },
      "long-reminder-lead-0001",
    );
    assert.equal(retry.projectId, result.projectId);
    s.settings.set(result.projectId, { ...card, leadMinutes: 1440 });
    await assert.rejects(
      () =>
        s.service.link(
          "task",
          { expectedRevision: 1, leadMinutes },
          "long-reminder-lead-0002",
        ),
      { code: "reminder-settings-conflict" },
    );
    assert.equal(s.settings.get(result.projectId).leadMinutes, 1440);
  });
test("long leads cannot create a past reminder and manual edits retaining the outbox marker block recovery", async () => {
  const s = setup();
  await assert.rejects(
    () =>
      s.service.link(
        "task",
        { expectedRevision: 0, leadMinutes: 4320 },
        "past-reminder-lead-0001",
      ),
    { code: "reminder-time-in-past" },
  );
  assert.equal(s.repository.get("studyRecords", "tasks_task").revision, 0);
  s.task.due = "2026-11-20T12:00:00Z";
  const rec = s.repository.get("studyRecords", "tasks_task");
  s.repository.seed("studyRecords", "tasks_task", {
    ...rec,
    payload: JSON.stringify(s.task),
  });
  s.setPhase("after-claim");
  assert.equal(
    (
      await s.service.link(
        "task",
        { expectedRevision: 0, leadMinutes: 4320 },
        "manual-lead-change-0001",
      )
    ).status,
    "pending",
  );
  for (const [id, value] of s.settings)
    s.settings.set(id, { ...value, leadMinutes: 5760 });
  s.setPhase("");
  const result = await s.service.link(
    "task",
    { expectedRevision: 0, leadMinutes: 4320 },
    "manual-lead-change-0001",
  );
  assert.equal(result.status, "blocked");
  assert.equal(s.settings.get(result.projectId).leadMinutes, 5760);
});

test("absolute task reminders work without a deadline and preserve user schedule on replay", async () => {
  const s = setup();
  const record = s.repository.get("studyRecords", "tasks_task");
  const task = JSON.parse(record.payload);
  task.due = "";
  s.repository.seed("studyRecords", "tasks_task", {
    ...record,
    payload: JSON.stringify(task),
  });
  const body = {
    expectedRevision: 0,
    schedule: {
      mode: "absolute",
      scheduledAt: "2026-11-15T09:00:00+02:00",
      timeZone: "Asia/Jerusalem",
    },
  };
  const result = await s.service.link(
    "task",
    body,
    "synthetic-absolute-reminder-0001",
  );
  assert.equal(result.verified, true);
  assert.equal(result.scheduled, true);
  assert.equal(s.repository.get("projects", result.projectId).dueDate, "");
  assert.equal(s.settings.get(result.projectId).schedule.mode, "absolute");
  const again = await s.service.link(
    "task",
    body,
    "synthetic-absolute-reminder-0001",
  );
  assert.equal(again.projectId, result.projectId);
  assert.equal(s.settings.size, 1);
});

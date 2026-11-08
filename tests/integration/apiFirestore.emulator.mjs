import { test } from "node:test";
import assert from "node:assert/strict";
import { createApiRepository } from "../../push-worker/src/apiFirestore.mjs";
import { createApiStudyService } from "../../push-worker/src/apiStudyService.mjs";
const host = process.env.FIRESTORE_EMULATOR_HOST,
  project = "demo-wilo-public-api";
if (!host || !/^127\.0\.0\.1:\d+$/.test(host))
  throw Error("Local Firestore emulator required");
const env = { FIREBASE_PROJECT_ID: project },
  options = {
    endpoint: `http://${host}/v1/projects/${project}/databases/(default)/documents`,
    token: "owner",
  };
const repository = (uid) => createApiRepository(env, uid, options);
const service = (uid) =>
  createApiStudyService({ repository: repository(uid), ownerUid: uid });
const create = (s, kind, values, idempotencyKey) =>
  s.mutate({
    kind,
    method: "POST",
    body: { values },
    idempotencyKey,
    path: "/api/v1/" + kind,
  });
test("real Firestore REST transactions save planner records and receipts atomically, CAS and ownership hold", async () => {
  const uid = "synthetic-" + crypto.randomUUID(),
    s = service(uid);
  const course = await create(
    s,
    "courses",
    { name: "Synthetic REST course" },
    "rest-course-create-0001",
  );
  const replay = await create(
    s,
    "courses",
    { name: "Synthetic REST course" },
    "rest-course-create-0001",
  );
  assert.equal(replay.id, course.id);
  assert.equal(replay.replayed, true);
  const task = await create(
    s,
    "tasks",
    { courseId: course.id, title: "Synthetic task", kind: "assignment" },
    "rest-task-create-00001",
  );
  const rows = await s.read("tasks");
  assert.equal(rows.items[0].id, task.id);
  assert.equal(rows.items[0].revision, 0);
  const changed = await s.mutate({
    kind: "tasks",
    id: task.id,
    method: "PATCH",
    body: { expectedRevision: 0, values: { title: "Changed" } },
    idempotencyKey: "rest-task-update-00001",
    path: "/api/v1/tasks/" + task.id,
  });
  assert.equal(changed.revision, 1);
  await assert.rejects(
    s.mutate({
      kind: "tasks",
      id: task.id,
      method: "PATCH",
      body: { expectedRevision: 0, values: { title: "Stale" } },
      idempotencyKey: "rest-task-update-00002",
      path: "/api/v1/tasks/" + task.id,
    }),
    /revision-conflict/,
  );
  assert.equal((await service(uid + "-other").read("courses")).items.length, 0);
  const card = await create(
    s,
    "projects",
    { name: "Synthetic card", nextStep: "Read" },
    "rest-card-create-00001",
  );
  assert.equal(card.id.length, 20);
  const section = await create(
    s,
    "sections",
    { name: "Synthetic section" },
    "rest-section-create-01",
  );
  assert.equal((await s.read("sections")).items[0].id, section.id);
  await s.mutate({
    kind: "board",
    id: "personal",
    method: "PUT",
    body: {
      expectedRevision: 0,
      state: {
        version: 1,
        items: [
          { id: "note", kind: "note", text: "Synthetic only", x: 0, y: 0 },
        ],
        threads: [],
        circles: [],
      },
    },
    idempotencyKey: "rest-board-update-0001",
    path: "/api/v1/boards/personal",
  });
  assert.equal((await s.read("board")).revision, 1);
});
test("failed domain validation leaves neither entity nor idempotency receipt", async () => {
  const uid = "invalid-" + crypto.randomUUID(),
    s = service(uid);
  await assert.rejects(
    create(
      s,
      "tasks",
      { courseId: "missing", title: "Invalid" },
      "rest-failure-00000001",
    ),
    /invalid-input/,
  );
  assert.equal((await s.read("tasks")).items.length, 0);
  const c = await create(
    s,
    "courses",
    { name: "Valid" },
    "rest-failure-00000001",
  );
  assert.equal(c.created, true);
});
test("concurrent create replays same receipt rather than duplicating writes", async () => {
  const s = service("concurrent-" + crypto.randomUUID());
  const values = { name: "Same" };
  const results = await Promise.all([
    create(s, "courses", values, "rest-concurrent-00001"),
    create(s, "courses", values, "rest-concurrent-00001"),
  ]);
  assert.equal(results[0].id, results[1].id);
  assert.equal((await s.read("courses")).items.length, 1);
});

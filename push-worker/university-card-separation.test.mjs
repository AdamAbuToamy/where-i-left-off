import { test } from "node:test";
import assert from "node:assert/strict";
import { createApiStudyService } from "./src/apiStudyService.mjs";
import { MemoryRepository } from "../tests/helpers/apiMemoryRepository.mjs";
const owner = "synthetic-owner",
  courseId = "course1",
  taskId = "task1",
  projectId = "a".repeat(20);
function setup() {
  const repository = new MemoryRepository(owner);
  const course = {
    id: courseId,
    name: "Synthetic course",
    url: "",
    notes: "",
    requires: [],
    x: 0,
    y: 0,
  };
  repository.seed("studyRecords", "courses_" + courseId, {
    kind: "courses",
    id: courseId,
    payload: JSON.stringify(course),
    deleted: false,
    revision: 0,
    mutationId: "seed",
  });
  return {
    repository,
    service: createApiStudyService({ repository, ownerUid: owner }),
  };
}
test("API task creation writes only the university task and remains course-scoped", async () => {
  const { repository, service } = setup();
  const result = await service.mutate({
    kind: "tasks",
    method: "POST",
    body: {
      values: {
        courseId,
        title: "Synthetic assignment",
        kind: "assignment",
        due: "",
        notes: "",
        url: "",
        done: false,
      },
    },
    idempotencyKey: "synthetic-task-creation-01",
    path: "/tasks",
  });
  assert.equal(
    [...repository.docs.keys()].filter((k) => k.startsWith("projects/")).length,
    0,
  );
  const tasks = await service.read("tasks", { courseId });
  assert.equal(tasks.items.length, 1);
  assert.equal(tasks.items[0].courseId, courseId);
  assert.equal((await service.read("projects")).items.length, 0);
  const replay = await service.mutate({
    kind: "tasks",
    method: "POST",
    body: {
      values: {
        courseId,
        title: "Synthetic assignment",
        kind: "assignment",
        due: "",
        notes: "",
        url: "",
        done: false,
      },
    },
    idempotencyKey: "synthetic-task-creation-01",
    path: "/tasks",
  });
  assert.equal(replay.replayed, true);
  assert.equal((await service.read("tasks", { courseId })).items.length, 1);
});
test("existing backing records stay stored but are absent from personal-card API, unlike explicit personal copies", async () => {
  const { repository, service } = setup();
  const task = {
    id: taskId,
    courseId,
    title: "Assignment 2",
    kind: "assignment",
    due: "2026-11-18T21:59:00.000Z",
    done: false,
    notes: "",
    url: "",
    reminderProjectId: projectId,
  };
  repository.seed("studyRecords", "tasks_" + taskId, {
    kind: "tasks",
    id: taskId,
    payload: JSON.stringify(task),
    deleted: false,
    revision: 0,
    mutationId: "seed",
  });
  const card = {
    name: task.title,
    nextStep: "",
    status: "active",
    kind: "deadline",
    resourceType: "course",
    rank: 0,
    revision: 0,
  };
  repository.seed("projects", projectId, card);
  repository.seed("projects", "b".repeat(20), card);
  repository.seed("projects", "c".repeat(20), {
    ...card,
    resourceType: "project",
  });
  const before = structuredClone([...repository.docs]);
  const listed = await service.read("projects");
  assert.deepEqual(
    listed.items.map((p) => p.id),
    ["b".repeat(20), "c".repeat(20)],
  );
  assert.equal(
    (await service.read("tasks", { courseId })).items[0].reminderProjectId,
    projectId,
  );
  assert.deepEqual([...repository.docs], before);
});

test('filters helpers before pagination without consuming a visible-card page',async()=>{
 const {repository,service}=setup();const task={id:taskId,courseId,title:'Same title',kind:'assignment',due:'',done:false,notes:'',url:'',reminderProjectId:projectId};repository.seed('studyRecords','tasks_'+taskId,{kind:'tasks',id:taskId,payload:JSON.stringify(task),deleted:false,revision:0});
 const card={name:'Same title',nextStep:'',kind:'deadline',resourceType:'course',status:'active',rank:0,revision:0};for(const id of [projectId,'b'.repeat(20),'c'.repeat(20)])repository.seed('projects',id,card);
 const first=await service.read('projects',{limit:1});assert.equal(first.items[0].id,'b'.repeat(20));assert.equal(first.nextCursor,'b'.repeat(20));const second=await service.read('projects',{limit:1,cursor:first.nextCursor});assert.equal(second.items[0].id,'c'.repeat(20));assert.equal(second.nextCursor,null);
});

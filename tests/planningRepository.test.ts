import { expect, it } from "vitest";
import {
  addBoardNote,
  editBoardNote,
  emptyPlanningState,
} from "../src/planning/domain";
import { BoardConflict, PlanningRepository } from "../src/planning/repository";
import type {
  BoardJournal,
  BoardRecord,
  BoardRemote,
} from "../src/planning/repository";
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const settle = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};
function server() {
  let current: BoardRecord | null = null,
    online = true,
    gate: Promise<void> | null = null;
  let writes = 0;
  const listeners = new Set<
    (value: BoardRecord | null, cached: boolean) => void
  >();
  const publish = () => listeners.forEach((fn) => fn(copy(current), !online));
  const remote: BoardRemote = {
    watch(receive) {
      listeners.add(receive);
      receive(copy(current), !online);
      return () => listeners.delete(receive);
    },
    async write(state, expected, mutationId) {
      writes++;
      if (gate) await gate;
      if (!online) throw new Error("offline");
      if (current?.mutationId === mutationId) return copy(current);
      if ((current?.revision ?? null) !== expected)
        throw new BoardConflict(copy(current));
      current = {
        state: copy(state),
        revision: (current?.revision ?? 0) + 1,
        mutationId,
      };
      publish();
      return copy(current);
    },
  };
  return {
    remote,
    publish,
    get current() {
      return current;
    },
    get writes() {
      return writes;
    },
    online(value: boolean) {
      online = value;
      publish();
    },
    block(value: Promise<void> | null) {
      gate = value;
    },
  };
}
let devices = 0;
function device(shared: ReturnType<typeof server>, initial: unknown = null) {
  const prefix = "device_" + ++devices + "_";
  let stored: unknown = copy(initial),
    current = true,
    broken = false,
    sequence = 0;
  const queued: (() => void)[] = [];
  const create = () =>
    new PlanningRepository({
      local: {
        read: () => copy(stored),
        write: (value) => {
          if (broken) throw new Error("quota");
          stored = copy(value);
        },
      },
      remote: shared.remote,
      isCurrent: () => current,
      newId: () => prefix + ++sequence,
      schedule: (work) => {
        queued.push(work);
        return () => {};
      },
    });
  return {
    create,
    get stored() {
      return stored as BoardJournal;
    },
    current(value: boolean) {
      current = value;
    },
    broken(value: boolean) {
      broken = value;
    },
  };
}
const note = () => addBoardNote(emptyPlanningState(), "note", { x: 25, y: 60 });
it("restores offline edits and syncs the latest state without dropping notes", async () => {
  const shared = server();
  shared.online(false);
  const local = device(shared),
    first = local.create();
  first.start(() => {});
  first.apply(note());
  first.apply(editBoardNote(first.state, "note", "offline draft"));
  first.stop();
  const restored = local.create();
  restored.start(() => {});
  expect(restored.state.items[0]).toHaveProperty("text", "offline draft");
  expect(restored.view.pending).toBe(true);
  shared.online(true);
  await restored.flush();
  expect(shared.current?.state.items[0]).toHaveProperty(
    "text",
    "offline draft",
  );
  expect(restored.view.pending).toBe(false);
  restored.stop();
});
it("requires an explicit choice when another device changes a queued canvas", async () => {
  const shared = server(),
    one = device(shared).create();
  one.start(() => {});
  one.apply(note());
  await one.flush();
  const two = device(shared).create();
  two.start(() => {});
  two.apply(editBoardNote(two.state, "note", "device two"));
  one.apply(editBoardNote(one.state, "note", "device one"));
  await one.flush();
  expect(two.view.conflict).toBe(true);
  const count = shared.writes;
  await two.flush();
  expect(shared.writes).toBe(count);
  expect(two.state.items[0]).toHaveProperty("text", "device two");
  two.resolve("local");
  await two.flush();
  expect(shared.current?.state.items[0]).toHaveProperty("text", "device two");
  one.stop();
  two.stop();
});
it("keeps an edit made during a pending write and drains it when the dialog closes", async () => {
  const shared = server(),
    local = device(shared),
    repo = local.create();
  repo.start(() => {});
  let release: () => void = () => {};
  shared.block(
    new Promise<void>((resolve) => {
      release = resolve;
    }),
  );
  repo.apply(note());
  const saving = repo.flush();
  repo.apply(editBoardNote(repo.state, "note", "newer while saving"));
  repo.stop();
  shared.block(null);
  release();
  await saving;
  await settle();
  expect(shared.current?.state.items[0]).toHaveProperty(
    "text",
    "newer while saving",
  );
  expect(local.stored.pending).toBeNull();
});
it("preserves undo through duplicate cloud acknowledgements", async () => {
  const shared = server(),
    repo = device(shared).create();
  repo.start(() => {});
  repo.apply(note());
  await repo.flush();
  shared.publish();
  expect(repo.view.canUndo).toBe(true);
  repo.undo();
  await repo.flush();
  expect(shared.current?.state.items).toEqual([]);
  repo.stop();
});
it("does not claim acceptance after cache failure or overwrite malformed cached data", () => {
  const shared = server(),
    local = device(shared),
    repo = local.create();
  repo.start(() => {});
  local.broken(true);
  expect(() => repo.apply(note())).toThrow("planning-local");
  expect(repo.state.items).toEqual([]);
  expect(repo.view.error).toBe("local");
  repo.stop();
  const corrupt = {
    version: 1,
    base: { revision: 1, state: { broken: true } },
    pending: null,
  };
  const bad = device(shared, corrupt),
    blocked = bad.create();
  blocked.start(() => {});
  expect(blocked.view.error).toBe("invalid-local");
  expect(() => blocked.apply(note())).toThrow();
  expect(bad.stored).toEqual(corrupt);
  blocked.stop();
});
it("never writes a queued board after its account changes", async () => {
  const shared = server(),
    local = device(shared),
    repo = local.create();
  repo.start(() => {});
  repo.apply(note());
  local.current(false);
  await repo.flush();
  expect(shared.writes).toBe(0);
  expect(() => repo.apply(note())).toThrow("planning-account");
  repo.stop();
});

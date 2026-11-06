import { expect, it } from "vitest";
import {
  emptyPlanningState,
  addBoardCard,
  addBoardNote,
  editBoardNote,
  connectBoardItems,
  editBoardThread,
  addBoardZone,
  editBoardZone,
  moveBoardItem,
  removeBoardItem,
  parsePlanningState,
  boardBlockers,
  boardNeighborhood,
  convertBoardNote,
  boardBounds,
} from "../src/planning/domain";
const graph = () => {
  let s = emptyPlanningState();
  for (const [i, id] of ["a", "b", "c"].entries())
    s = addBoardCard(s, id, { x: i * 300, y: 100 });
  s = connectBoardItems(s, "ab", "a", "b");
  return connectBoardItems(s, "bc", "b", "c");
};
it("loads original boards unchanged and validates bounded semantic metadata", () => {
  const old = graph();
  expect(parsePlanningState(old)).toEqual(old);
  const next = editBoardThread(old, "ab", {
    kind: "depends",
    label: "Wait for delivery",
  });
  expect(parsePlanningState(JSON.parse(JSON.stringify(next)))).toEqual(next);
  expect(old.threads[0].kind).toBeUndefined();
  expect(() =>
    editBoardThread(old, "ab", { label: "x".repeat(241) }),
  ).toThrow();
  expect(() =>
    parsePlanningState({
      ...old,
      threads: [{ ...old.threads[0], kind: "execute" }],
    }),
  ).toThrow();
  expect(() =>
    parsePlanningState({
      ...old,
      threads: [{ ...old.threads[0], commands: [] }],
    }),
  ).toThrow();
});
it("rejects circular dependencies and preserves direction when changing meaning", () => {
  let s = editBoardThread(
    editBoardThread(graph(), "ab", { kind: "depends" }),
    "bc",
    { kind: "depends" },
  );
  s = connectBoardItems(s, "ca", "c", "a");
  expect(() => editBoardThread(s, "ca", { kind: "depends" })).toThrow();
  const reversed = editBoardThread(s, "ab", { reverse: true });
  expect(reversed.threads[0]).toMatchObject({
    source: "b",
    target: "a",
    kind: "depends",
  });
});
it("derives blockers from live statuses without mutating cards or blocking finished work", () => {
  const s = editBoardThread(graph(), "ab", { kind: "depends" }),
    status = new Map([
      ["a", "active"],
      ["b", "later"],
    ]);
  expect(boardBlockers(s, "a", status).map((i) => i.projectId)).toEqual(["b"]);
  status.set("b", "done");
  expect(boardBlockers(s, "a", status)).toEqual([]);
  status.delete("b");
  expect(boardBlockers(s, "a", status)).toHaveLength(1);
  status.set("a", "done");
  expect(boardBlockers(s, "a", status)).toEqual([]);
  expect([...boardNeighborhood(s, "a")]).toEqual(["a", "b"]);
});
it("moves contained papers with an area and removes only its frame", () => {
  let s = addBoardZone(graph(), "zone", { x: -20, y: 0 }, "Build");
  s = editBoardZone(s, "zone", { width: 450, height: 300 });
  const moved = moveBoardItem(s, "zone", { x: 80, y: 50 });
  expect(moved.items.find((i) => i.id === "a")).toMatchObject({
    x: 100,
    y: 150,
  });
  expect(moved.items.find((i) => i.id === "b")).toMatchObject({
    x: 400,
    y: 150,
  });
  expect(moved.items.find((i) => i.id === "c")).toMatchObject({
    x: 600,
    y: 100,
  });
  const removed = removeBoardItem(moved, "zone");
  expect(removed.items).toHaveLength(3);
  expect(removed.threads).toEqual(moved.threads);
  expect(() => editBoardZone(s, "zone", { width: Infinity })).toThrow();
  expect(() => connectBoardItems(s, "bad", "a", "zone")).toThrow();
});
it("converts a note reference only after creation, keeping its position and all threads", () => {
  let s = editBoardNote(
    addBoardNote(graph(), "note", { x: 15, y: 40 }),
    "note",
    "Original note",
  );
  s = connectBoardItems(s, "an", "a", "note");
  const next = convertBoardNote(s, "note", "new-card");
  expect(next.items.find((i) => i.id === "note")).toEqual({
    id: "note",
    kind: "card",
    projectId: "new-card",
    x: 15,
    y: 40,
  });
  expect(next.threads).toEqual(s.threads);
  expect(s.items.at(-1)).toHaveProperty("text", "Original note");
  expect(() => convertBoardNote(s, "note", "a")).toThrow();
});
it("fits circles outside card bounds and handles an empty board", () => {
  expect(boardBounds(emptyPlanningState())).toBeNull();
  const s = {
    ...graph(),
    circles: [{ id: "circle", x: -1000, y: -500, width: 100, height: 80 }],
  };
  expect(boardBounds(s)).toEqual({
    x: -1000,
    y: -500,
    width: 1860,
    height: 820,
  });
});

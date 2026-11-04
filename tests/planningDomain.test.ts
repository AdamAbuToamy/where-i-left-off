import { expect, it } from "vitest";
import {
  addBoardCard,
  addBoardNote,
  connectBoardItems,
  editBoardNote,
  emptyPlanningState,
  moveBoardItem,
  parsePlanningState,
  recognizeCircle,
  removeBoardItem,
} from "../src/planning/domain";
it("keeps card references separate from ranks/content and connects notes to cards", () => {
  let state = addBoardCard(emptyPlanningState(), "card", { x: 137, y: -88 });
  state = addBoardNote(state, "note", { x: -70, y: 391 });
  state = editBoardNote(state, "note", "ملاحظة مستقلة");
  state = connectBoardItems(state, "thread", "card", "note");
  expect(state.items[0]).toEqual({
    id: "card",
    kind: "card",
    projectId: "card",
    x: 137,
    y: -88,
  });
  expect(addBoardCard(state, "card", { x: 0, y: 0 })).toBe(state);
  expect(connectBoardItems(state, "other", "note", "card")).toBe(state);
  const moved = moveBoardItem(state, "card", { x: 321, y: 123 });
  expect(moved.items[0].x).toBe(321);
  const removed = removeBoardItem(moved, "card");
  expect(removed.threads).toEqual([]);
  expect(removed.items).toHaveLength(1);
  expect(removed.items[0].kind).toBe("note");
});
it("rejects dangling/self links, duplicate references, nonfinite coordinates and unexpected fields", () => {
  const state = addBoardCard(emptyPlanningState(), "card", { x: 0, y: 0 });
  for (const bad of [
    { ...state, actions: ["delete-all"] },
    { ...state, items: [{ ...state.items[0], x: Infinity }] },
    { ...state, items: [{ ...state.items[0], x: 20001 }] },
    { ...state, items: [...state.items, { ...state.items[0], id: "other" }] },
    { ...state, threads: [{ id: "edge", source: "card", target: "missing" }] },
    { ...state, threads: [{ id: "edge", source: "card", target: "card" }] },
    { ...state, items: [{ ...state.items[0], rank: 100 }] },
  ])
    expect(() => parsePlanningState(bad)).toThrow("planning-invalid");
});
it("bounds note count and payload without interpreting note text as HTML or instructions", () => {
  const state = editBoardNote(
    addBoardNote(emptyPlanningState(), "note", { x: 0, y: 0 }),
    "note",
    "<script>not executable</script>",
  );
  expect(state.items[0]).toHaveProperty(
    "text",
    "<script>not executable</script>",
  );
  expect(() => editBoardNote(state, "note", "x".repeat(2001))).toThrow();
  expect(() =>
    parsePlanningState({
      ...state,
      items: Array.from({ length: 201 }, (_, i) => ({
        id: "n" + i,
        kind: "note",
        text: "",
        x: 0,
        y: 0,
      })),
    }),
  ).toThrow();
  expect(() =>
    parsePlanningState({
      ...state,
      items: Array.from({ length: 100 }, (_, i) => ({
        id: "n" + i,
        kind: "note",
        text: "x".repeat(2000),
        x: 0,
        y: 0,
      })),
    }),
  ).toThrow("planning-full");
});
it("turns a closed noisy oval into bounded ellipse geometry and rejects open/line gestures", () => {
  const points = Array.from({ length: 97 }, (_, i) => {
    const angle = (i / 96) * Math.PI * 2;
    return {
      x: 200 + 120 * Math.cos(angle) + ((i % 3) - 1),
      y: 180 + 70 * Math.sin(angle) + ((i % 5) - 2),
    };
  });
  const circle = recognizeCircle(points, "circle");
  expect(circle.width).toBeGreaterThan(235);
  expect(circle.height).toBeGreaterThan(135);
  expect(circle.x).toBeCloseTo(79, 0);
  expect(() => recognizeCircle(points.slice(0, 40), "open")).toThrow(
    "planning-circle",
  );
  expect(() =>
    recognizeCircle(
      Array.from({ length: 30 }, (_, i) => ({ x: i * 3, y: 20 })),
      "line",
    ),
  ).toThrow("planning-circle");
});

import { expect, it } from "vitest";
import {
  clampLauncher,
  positionForDock,
  snapLauncher,
  validDock,
} from "../src/assistant/mobileLauncherGeometry";
const bounds = { width: 390, height: 844, buttonWidth: 170, buttonHeight: 52 };
it("snaps a free drag to each nearest screen edge and stays within bounds", () => {
  for (const [point, edge] of [
    [{ x: 20, y: 320 }, "left"],
    [{ x: 205, y: 320 }, "right"],
    [{ x: 100, y: 15 }, "top"],
    [{ x: 100, y: 775 }, "bottom"],
  ] as const) {
    const dock = snapLauncher(point, bounds);
    expect(dock.edge).toBe(edge);
    const placed = positionForDock(dock, bounds);
    expect(placed.x).toBeGreaterThanOrEqual(12);
    expect(placed.x + 170).toBeLessThanOrEqual(378);
    expect(placed.y).toBeGreaterThanOrEqual(12);
    expect(placed.y + 52).toBeLessThanOrEqual(832);
  }
  expect(clampLauncher({ x: -999, y: 9999 }, bounds)).toEqual({
    x: 12,
    y: 780,
  });
});
it("persists an edge-relative position across portrait, landscape and narrower screens", () => {
  const dock = snapLauncher({ x: 208, y: 410 }, bounds);
  expect(dock.edge).toBe("right");
  const changed = {
    width: 844,
    height: 390,
    buttonWidth: 170,
    buttonHeight: 52,
  };
  const point = positionForDock(dock, changed);
  expect(point.x + 170).toBe(832);
  expect(point.y).toBeCloseTo(12 + dock.ratio * (390 - 52 - 24));
  expect(
    positionForDock(
      { edge: "bottom", ratio: 0.5 },
      { width: 320, height: 500, buttonWidth: 170, buttonHeight: 52 },
    ),
  ).toEqual({ x: 75, y: 436 });
});
it("rejects corrupt or untrusted device placement", () => {
  for (const value of [
    null,
    {},
    { edge: "middle", ratio: 0.5 },
    { edge: "left", ratio: -1 },
    { edge: "top", ratio: Infinity },
    { edge: "right", ratio: "0.5" },
  ])
    expect(validDock(value)).toBe(false);
  expect(validDock({ edge: "bottom", ratio: 1 })).toBe(true);
});

it("respects the phone notch and home-indicator safe areas", () => {
  const safe = {
    ...bounds,
    safeArea: { top: 44, right: 0, bottom: 34, left: 0 },
  };
  expect(positionForDock({ edge: "top", ratio: 0.5 }, safe).y).toBe(56);
  expect(positionForDock({ edge: "bottom", ratio: 0.5 }, safe).y + 52).toBe(
    798,
  );
});

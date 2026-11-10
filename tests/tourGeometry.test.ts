import { it, expect } from "vitest";
import {
  journeyCompanionPosition,
  journeyFocusRect,
} from "../src/components/tourGeometry";
import { journeyText } from "../src/components/journeyText";
import { journeySteps } from "../src/components/journeySession";
it("clips highlights within desktop, narrow phone and landscape viewports", () => {
  for (const view of [
    { width: 390, height: 844 },
    { width: 1440, height: 1000 },
    { width: 700, height: 360 },
    { width: 320, height: 568 },
  ])
    for (const target of [
      null,
      { x: 10, y: 12, width: 120, height: 44 },
      { x: view.width - 70, y: view.height - 60, width: 200, height: 180 },
      { x: 0, y: -700, width: view.width, height: 2000 },
      { x: 0, y: -300, width: 30, height: 20 },
    ]) {
      const focus = journeyFocusRect(target, view);
      if (focus) {
        expect(focus.x).toBeGreaterThanOrEqual(8);
        expect(focus.y).toBeGreaterThanOrEqual(8);
        expect(focus.x + focus.width).toBeLessThanOrEqual(view.width - 8);
        expect(focus.y + focus.height).toBeLessThanOrEqual(view.height - 8);
        expect(focus.width).toBeGreaterThan(0);
        expect(focus.height).toBeGreaterThan(0);
      }
    }
  expect(
    journeyFocusRect(
      { x: 0, y: -300, width: 30, height: 20 },
      { width: 390, height: 844 },
    ),
  ).toBeNull();
});
it("provides the same four essential activities in every language", () => {
  expect(journeySteps).toEqual([
    "welcome",
    "create",
    "card",
    "university",
    "groups",
    "finish",
  ]);
  for (const language of ["ar", "en", "he"] as const)
    for (const step of journeySteps)
      expect(journeyText[language][step].length).toBeGreaterThan(0);
});

it("places the companion beside controls without covering them when room exists", () => {
  for (const view of [
    { width: 390, height: 844 },
    { width: 1440, height: 1000 },
    { width: 320, height: 568 },
  ])
    for (const target of [
      { x: 20, y: 20, width: 120, height: 44 },
      { x: 100, y: 300, width: 120, height: 44 },
    ]) {
      const p = journeyCompanionPosition(target, view, {
        width: 320,
        height: 240,
      });
      expect(p.x).toBeGreaterThanOrEqual(12);
      expect(p.y).toBeGreaterThanOrEqual(12);
      expect(p.x + p.width).toBeLessThanOrEqual(view.width - 12);
      expect(p.y + p.height).toBeLessThanOrEqual(view.height - 12);
      const overlap =
        Math.max(
          0,
          Math.min(p.x + p.width, target.x + target.width) -
            Math.max(p.x, target.x),
        ) *
        Math.max(
          0,
          Math.min(p.y + p.height, target.y + target.height) -
            Math.max(p.y, target.y),
        );
      expect(overlap).toBe(0);
    }
});

it("keeps the card itself visible while pointing at its expand button", () => {
  const card = { x: 240, y: 540, width: 310, height: 210 },
    target = { x: 260, y: 690, width: 270, height: 55 };
  const p = journeyCompanionPosition(
    target,
    { width: 1440, height: 1000 },
    { width: 320, height: 260 },
    card,
  );
  expect(
    p.x >= card.x + card.width ||
      p.y >= card.y + card.height ||
      p.x + p.width <= card.x ||
      p.y + p.height <= card.y,
  ).toBe(true);
});

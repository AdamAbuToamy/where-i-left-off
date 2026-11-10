import { it, expect } from "vitest";
import { journeyFocusRect } from "../src/components/tourGeometry";
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

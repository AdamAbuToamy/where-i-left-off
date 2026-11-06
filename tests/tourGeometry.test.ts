import { it, expect } from "vitest";
import { tourGeometry } from "../src/components/tourGeometry";
import { tourText } from "../src/tourText";
it("keeps the explanation and spotlight within desktop, phone and landscape bounds", () => {
  for (const view of [
    { width: 390, height: 844 },
    { width: 1440, height: 1000 },
    { width: 700, height: 360 },
    { width: 320, height: 568 },
  ])
    for (const target of [
      null,
      { x: 10, y: 12, width: 120, height: 44 },
      { x: view.width - 70, y: view.height - 60, width: 65, height: 48 },
      { x: 0, y: -700, width: view.width, height: 2000 },
    ]) {
      const { focus, card } = tourGeometry(target, view, {
        width: 420,
        height: 340,
      });
      expect(card.x).toBeGreaterThanOrEqual(12);
      expect(card.y).toBeGreaterThanOrEqual(12);
      expect(card.x + card.width).toBeLessThanOrEqual(view.width - 12);
      expect(card.y + card.height).toBeLessThanOrEqual(view.height - 12);
      if (focus) {
        expect(focus.width).toBeGreaterThan(0);
        expect(focus.height).toBeGreaterThan(0);
        expect(focus.x + focus.width).toBeLessThanOrEqual(view.width - 16);
        expect(focus.y + focus.height).toBeLessThanOrEqual(view.height - 16);
      }
    }
});
it("provides localized coverage across the actual app areas and keeps admin steps restricted", () => {
  for (const language of ["ar", "en", "he"] as const) {
    const steps = tourText[language].steps;
    for(const step of steps){const english=tourText.en.steps.find(value=>value.id===step.id);expect(step.targets).toEqual(english?.targets);expect(step.hash).toBe(english?.hash);}
    for (const id of [
      "cards",
      "create",
      "details",
      "session",
      "find",
      "week",
      "board",
      "resume",
      "courses",
      "tasks",
      "timetable",
      "map",
      "groups",
      "archive",
      "trash",
      "review",
      "analytics",
      "notifications",
      "assistant",
      "profile",
      "appearance",
      "workflow",
      "install",
      "privacy",
      "help",
    ])
      expect(steps.some((step) => step.id === id)).toBe(true);
    expect(new Set(steps.map((s) => s.id)).size).toBe(steps.length);
    expect(steps.find((s) => s.id === "board")?.desktopOnly).toBe(true);
    expect(steps.find((s) => s.id === "admin")?.adminOnly).toBe(true);
    expect(
      steps.every(
        (s) => s.title.length > 0 && s.body.length > 0 && s.targets.length > 0,
      ),
    ).toBe(true);
  }
});

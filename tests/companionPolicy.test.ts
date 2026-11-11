import { describe, it, expect } from "vitest";
import {
  DAY,
  defaultCompanionPreferences,
  featureKey,
  selectSuggestion,
} from "../src/companion/policy";
import type { CompanionState, CompanionItem } from "../src/companion/policy";
const now = Date.UTC(2026, 10, 11, 10);
const base = (): CompanionState => ({
  preferences: { ...defaultCompanionPreferences },
  seen: {},
  visits: {},
  shown: [],
  pausedUntil: 0,
});
const task: CompanionItem = {
  kind: "task",
  id: "owned-task",
  courseId: "owned-course",
  title: "Synthetic deadline",
  dueAt: now + 2 * DAY,
};
describe("contextual companion policy", () => {
  it("prioritizes a real approaching deadline and ignores expired/invalid dates", () => {
    expect(selectSuggestion([task], base(), now, true)?.item).toEqual(task);
    expect(
      selectSuggestion(
        [
          { ...task, dueAt: NaN },
          { ...task, dueAt: now - 1 },
        ],
        base(),
        now,
        false,
      )?.category,
    ).toBe("features");
  });
  it("never invents an inactivity date", () => {
    const state = base();
    state.preferences.features = false;
    state.preferences.extension = false;
    const card: CompanionItem = { kind: "card", id: "a", title: "Card" };
    expect(selectSuggestion([card], state, now, false)).toBeNull();
    state.visits["card:a"] = now - 15 * DAY;
    expect(selectSuggestion([card], state, now, false)?.category).toBe("stale");
    state.visits["card:a"] = now;
    expect(selectSuggestion([card], state, now, false)).toBeNull();
  });
  it("obeys global opt-out, each category and pause", () => {
    const state = base();
    state.preferences.enabled = false;
    expect(selectSuggestion([task], state, now, true)).toBeNull();
    state.preferences.enabled = true;
    state.preferences.deadlines = false;
    expect(selectSuggestion([task], state, now, true)?.category).toBe(
      "features",
    );
    state.preferences.features = false;
    expect(selectSuggestion([task], state, now, true)?.category).toBe(
      "extension",
    );
    state.preferences.extension = false;
    expect(selectSuggestion([task], state, now, true)).toBeNull();
    state.preferences.extension = true;
    state.pausedUntil = now + DAY;
    expect(selectSuggestion([task], state, now, true)).toBeNull();
  });
  it("enforces rolling cooldown and daily caps without repeating a feature", () => {
    const state = base();
    state.shown = [now - 30 * 60000];
    expect(selectSuggestion([task], state, now, true)).toBeNull();
    state.preferences.frequency = "normal";
    expect(selectSuggestion([task], state, now, true)?.item).toEqual(task);
    state.shown = [now - 3 * 3600000, now - 2 * 3600000, now - 3600000];
    expect(selectSuggestion([task], state, now, true)).toBeNull();
    state.shown = [];
    state.seen[featureKey] = now - 60 * DAY;
    expect(selectSuggestion([], state, now, false)).toBeNull();
  });
  it("suppresses the same deadline and respects unavailable Chrome", () => {
    const state = base();
    const suggestion = selectSuggestion([task], state, now, false)!;
    state.seen[suggestion.key] = now;
    state.preferences.features = false;
    expect(selectSuggestion([task], state, now, false)).toBeNull();
  });
});

import { defaultCompanionPreferences, DAY } from "./policy";
import type { CompanionPreferences, CompanionState } from "./policy";
export const companionPreferenceEvent = "wilo-companion-preferences";
export const companionStorageKey = (uid: string) => `wilo-companion:v1:${uid}`;
const memory = new Map<string, CompanionState>();
const fresh = (): CompanionState => ({
  preferences: { ...defaultCompanionPreferences },
  seen: {},
  visits: {},
  shown: [],
  pausedUntil: 0,
});
function timestamps(value: unknown, limit: number): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(
        ([k, v]) =>
          k.length <= 300 &&
          typeof v === "number" &&
          Number.isFinite(v) &&
          v > 0,
      )
      .sort((a, b) => Number(b[1]) - Number(a[1]))
      .slice(0, limit),
  );
}
export function readCompanionState(uid: string): CompanionState {
  const cached = memory.get(uid);
  if (cached) return cached;
  const state = fresh();
  try {
    const raw = JSON.parse(
      localStorage.getItem(companionStorageKey(uid)) || "null",
    );
    if (raw && typeof raw === "object") {
      for (const key of [
        "enabled",
        "deadlines",
        "stale",
        "features",
        "extension",
      ] as const)
        if (typeof raw.preferences?.[key] === "boolean")
          state.preferences[key] = raw.preferences[key];
      if (raw.preferences?.frequency === "normal")
        state.preferences.frequency = "normal";
      state.seen = timestamps(raw.seen, 200);
      state.visits = timestamps(raw.visits, 300);
      if (Array.isArray(raw.shown))
        state.shown = raw.shown
          .filter(
            (n: unknown) =>
              typeof n === "number" && Number.isFinite(n) && n > 0,
          )
          .slice(-10);
      if (Number.isFinite(raw.pausedUntil)) state.pausedUntil = raw.pausedUntil;
    }
  } catch {
    state.preferences.enabled = false;
  }
  memory.set(uid, state);
  return state;
}
export function refreshCompanionState(uid: string) {
  memory.delete(uid);
  return readCompanionState(uid);
}
function save(uid: string, state: CompanionState) {
  memory.set(uid, state);
  let persisted = true;
  try {
    localStorage.setItem(companionStorageKey(uid), JSON.stringify(state));
  } catch {
    persisted = false;
    /* In-session opt-out still applies when storage is unavailable. */
  }
  window.dispatchEvent(
    new CustomEvent(companionPreferenceEvent, { detail: { uid } }),
  );
  return persisted;
}
export function saveCompanionPreferences(
  uid: string,
  preferences: CompanionPreferences,
) {
  const previous = readCompanionState(uid);
  return save(uid, {
    ...previous,
    preferences: { ...preferences },
    pausedUntil:
      preferences.enabled && !previous.preferences.enabled
        ? 0
        : previous.pausedUntil,
  });
}
export function rememberSuggestion(uid: string, key: string, now = Date.now()) {
  const state = readCompanionState(uid);
  save(uid, {
    ...state,
    seen: timestamps({ ...state.seen, [key]: now }, 200),
    shown: [...state.shown.filter((t) => t > now - DAY), now].slice(-10),
  });
}
export function pauseCompanion(uid: string, now = Date.now()) {
  save(uid, { ...readCompanionState(uid), pausedUntil: now + DAY });
}
export function recordCompanionVisit(
  uid: string,
  key: string,
  now = Date.now(),
) {
  const state = readCompanionState(uid);
  if (!state.preferences.enabled || !state.preferences.stale) return;
  save(uid, {
    ...state,
    visits: timestamps({ ...state.visits, [key]: now }, 300),
  });
}

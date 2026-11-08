import { afterEach, expect, test, vi } from "vitest";
import { readExperience, saveExperience } from "../src/experience/preferences";
afterEach(() => vi.unstubAllGlobals());
function storage(raw: string | null) {
  const values = new Map<string, string>();
  if (raw) values.set("wilo-experience:v1:owner", raw);
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) || null,
    setItem: (key: string, value: string) => values.set(key, value),
  });
  return values;
}
test("existing motion/sound opt-outs survive the additional controls", () => {
  storage('{"motion":false,"sound":false}');
  expect(readExperience("owner")).toEqual({
    motion: false,
    sound: false,
    intensity: "dramatic",
    ambient: true,
    interactions: true,
  });
});
test("motion preferences are account-scoped and malformed style falls back safely", () => {
  storage(
    '{"motion":true,"sound":false,"intensity":"unknown","ambient":false}',
  );
  expect(readExperience("owner").intensity).toBe("dramatic");
  expect(readExperience("owner").ambient).toBe(false);
  expect(readExperience("other").sound).toBe(true);
});
test("switches persist without retaining account content", () => {
  const values = storage(null);
  vi.stubGlobal("window", { dispatchEvent: vi.fn() });
  vi.stubGlobal(
    "CustomEvent",
    class {
      constructor(
        public type: string,
        public options: unknown,
      ) {}
    },
  );
  const next = {
    motion: true,
    sound: false,
    intensity: "calm" as const,
    ambient: false,
    interactions: false,
  };
  saveExperience("owner", next);
  expect(readExperience("owner")).toEqual(next);
  expect([...values.keys()]).toEqual(["wilo-experience:v1:owner"]);
});
test("unavailable device storage does not block the UI", () => {
  vi.stubGlobal("localStorage", {
    getItem() {
      throw Error("blocked");
    },
  });
  expect(readExperience("owner").motion).toBe(true);
});

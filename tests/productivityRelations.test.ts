import { it, expect } from "vitest";
import { emptyExperience } from "../src/productivity/state";
import { relate, blockers } from "../src/productivity/relations";
it("rejects dependency cycles and self-links; duplicate related links are idempotent", () => {
  const keys = new Set(["personal/a", "personal/b", "personal/c"]);
  let s = relate(
    emptyExperience(),
    { id: "a", source: "personal/a", target: "personal/b", kind: "depends" },
    keys,
  );
  s = relate(
    s,
    { id: "b", source: "personal/b", target: "personal/c", kind: "depends" },
    keys,
  );
  expect(() =>
    relate(
      s,
      { id: "c", source: "personal/c", target: "personal/a", kind: "depends" },
      keys,
    ),
  ).toThrow("cycle");
  expect(() =>
    relate(
      s,
      { id: "d", source: "personal/a", target: "personal/a", kind: "related" },
      keys,
    ),
  ).toThrow();
  expect(blockers(s, "personal/a", new Map([["personal/b", "done"]]))).toEqual(
    [],
  );
  expect(blockers(s, "personal/a", new Map())).toEqual(["personal/b"]);
  const related = relate(
    s,
    { id: "e", source: "personal/a", target: "personal/c", kind: "related" },
    keys,
  );
  expect(
    relate(
      related,
      { id: "f", source: "personal/c", target: "personal/a", kind: "related" },
      keys,
    ),
  ).toBe(related);
});

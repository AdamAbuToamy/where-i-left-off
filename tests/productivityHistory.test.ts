import { it, expect } from "vitest";
import { restoreContent, versionPayload } from "../src/productivity/history";
import type { Project } from "../src/types";
const old: Project = {
  id: "a",
  name: "Old",
  nextStep: "Old step",
  status: "later",
  rank: 0,
  revision: 0,
};
it("restores validated content but preserves current ordering and enforces the preview revision", () => {
  const current = { ...old, name: "New", revision: 4, rank: 4096 };
  const changes = restoreContent(current, old, 4, 123);
  expect(changes.name).toBe("Old");
  expect(changes).not.toHaveProperty("id");
  expect(changes).not.toHaveProperty("revision");
  expect(changes).not.toHaveProperty("rank");
  expect(() => restoreContent(current, old, 3, 123)).toThrow("conflict");
  expect(() => restoreContent(current, { ...old, id: "b" }, 4, 123)).toThrow(
    "conflict",
  );
  expect(() =>
    versionPayload({
      before: old,
      after: { ...old, projectUrl: "javascript:x" },
    }),
  ).toThrow();
});

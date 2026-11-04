import { expect, it } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { execFileSync } from "node:child_process";

it("versions the offline shell with the actual asset content and retains its offline routes", () => {
  const directory = mkdtempSync(join(tmpdir(), "wilo-shell-test-"));
  try {
    mkdirSync(join(directory, "dist", "assets"), { recursive: true });
    mkdirSync(join(directory, "public"));
    writeFileSync(
      join(directory, "public", "sw.js"),
      readFileSync("public/sw.js"),
    );
    writeFileSync(join(directory, "dist", "index.html"), "<html>app</html>");
    writeFileSync(
      join(directory, "dist", "assets", "ProfileSettings-example.js"),
      "export default 1",
    );
    const run = () => {
      execFileSync(process.execPath, [resolve("scripts/generate-sw.mjs")], {
        cwd: directory,
        stdio: "pipe",
      });
      return readFileSync(join(directory, "dist", "sw.js"), "utf8");
    };
    for (const name of [
      "PlanningBoardDialog-lazy.js",
      "PlanningBoardDialog-lazy.css",
    ]) {
      writeFileSync(join(directory, "dist", "assets", name), "optional canvas");
    }
    const first = run();
    const precache = /const PRECACHE = (\[.*?\]);/.exec(first)?.[1] || "[]";
    expect(
      JSON.parse(precache).some((path: string) =>
        path.includes("PlanningBoardDialog"),
      ),
    ).toBe(false);
    expect(first).toContain('"-planning-runtime"');

    const version =
      /const CACHE_NAME = "(where-i-left-off-shell-[a-f0-9]{16})"/.exec(
        first,
      )?.[1];
    expect(version).toBeTruthy();
    expect(first).not.toContain("where-i-left-off-shell-dev");
    expect(first).toContain("/assets/ProfileSettings-example.js");
    writeFileSync(
      join(directory, "dist", "assets", "ProfileSettings-example.js"),
      "export default 2",
    );
    expect(run()).not.toContain(version!);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

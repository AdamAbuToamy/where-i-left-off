import { it, expect } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
it("detects a secret removed from current files but retained in Git history without printing it", () => {
  const folder = mkdtempSync(join(tmpdir(), "wilo-secret-history-"));
  const git = (args: string[]) =>
    execFileSync("git", args, { cwd: folder, stdio: "pipe" });
  try {
    git(["init", "-q"]);
    git(["config", "user.name", "Security test"]);
    git(["config", "user.email", "test@example.test"]);
    const secret = ["sk_", "a".repeat(40)].join("");
    writeFileSync(join(folder, "old.txt"), secret);
    git(["add", "old.txt"]);
    git(["commit", "-qm", "fixture"]);
    rmSync(join(folder, "old.txt"));
    git(["add", "-u"]);
    git(["commit", "-qm", "remove fixture"]);
    const result = spawnSync(
      process.execPath,
      [resolve("scripts/check-git-secrets.mjs")],
      { cwd: folder, encoding: "utf8", timeout: 10000 },
    );
    expect(result.status).toBe(1);
    expect(result.stdout).not.toContain(secret);
    expect(result.stderr).not.toContain(secret);
    expect(JSON.parse(result.stdout).findings).toEqual([
      expect.objectContaining({ rule: "provider-secret", path: "old.txt" }),
    ]);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

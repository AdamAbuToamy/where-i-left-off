import { execFileSync, spawn } from "node:child_process";
const rules = [
  ["private-key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["service-account", /"type"\s*:\s*"service_account"/],
  [
    "github-token",
    /(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})/,
  ],
  [
    "provider-secret",
    /(?<![A-Za-z0-9_-])(?:sk_|gsk_|sk-ant-|sk-(?:proj-)?)[A-Za-z0-9_-]{32,}(?![A-Za-z0-9_-])/,
  ],
  ["aws-access-key", /(?<![A-Za-z0-9+/])AKIA[0-9A-Z]{16}(?![A-Za-z0-9+/])/],
];
const raw = execFileSync("git", ["rev-list", "--objects", "--all"], {
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
});
const paths = new Map(
  raw
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const split = line.indexOf(" ");
      return split < 0
        ? [line, ""]
        : [line.slice(0, split), line.slice(split + 1)];
    }),
);
const info = execFileSync("git", ["cat-file", "--batch-check"], {
  input: [...paths.keys()].join("\n") + "\n",
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
});
let oversized = 0;
const ids = info
  .trim()
  .split("\n")
  .filter((line) => {
    const [, kind, size] = line.split(" ");
    if (kind !== "blob") return false;
    if (Number(size) > 5_000_000) {
      oversized++;
      return false;
    }
    return true;
  })
  .map((line) => line.split(" ")[0]);
const processGit = spawn("git", ["cat-file", "--batch"], {
  stdio: ["pipe", "pipe", "pipe"],
});
const ended = new Promise((resolve, reject) => {
  processGit.on("error", reject);
  processGit.on("close", (code) =>
    code === 0 ? resolve() : reject(new Error("Git history read failed")),
  );
});
processGit.stderr.resume();
processGit.stdin.end(ids.join("\n") + "\n");
let buffer = Buffer.alloc(0),
  pending = null,
  scanned = 0,
  binary = 0;
const findings = [];
for await (const chunk of processGit.stdout) {
  buffer = Buffer.concat([buffer, chunk]);
  while (true) {
    if (!pending) {
      const split = buffer.indexOf(10);
      if (split < 0) break;
      const [oid, kind, length] = buffer
        .subarray(0, split)
        .toString("utf8")
        .split(" ");
      if (kind !== "blob" || !/^\d+$/.test(length))
        throw new Error("Invalid Git blob header");
      pending = { oid, length: Number(length) };
      buffer = buffer.subarray(split + 1);
    }
    if (buffer.length < pending.length + 1) break;
    const bytes = buffer.subarray(0, pending.length);
    scanned++;
    if (bytes.includes(0)) binary++;
    else {
      const text = bytes.toString("utf8");
      for (const [rule, pattern] of rules)
        if (pattern.test(text))
          findings.push({
            rule,
            blob: pending.oid,
            path: paths.get(pending.oid) || "(historical blob)",
          });
    }
    buffer = buffer.subarray(pending.length + 1);
    pending = null;
  }
}
await ended;
if (pending || buffer.length) throw new Error("Incomplete history scan");
console.log(
  JSON.stringify(
    {
      scope: "all-reachable-git-refs",
      scannedBlobs: scanned,
      binaryBlobs: binary,
      oversizedBlobsSkipped: oversized,
      findings,
      limitation:
        "Pattern scan only; arbitrary-format tokens and unreachable objects are not covered.",
    },
    null,
    2,
  ),
);
if (findings.length) process.exitCode = 1;

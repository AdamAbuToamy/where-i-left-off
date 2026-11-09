import { it, expect } from "vitest";
import { readFileSync } from "node:fs";
// @ts-expect-error Production operator entry point runs directly on Node.
import { workerReleaseConfig } from "../scripts/prepare-worker-release.mjs";
const template = JSON.parse(readFileSync("push-worker/wrangler.jsonc", "utf8"));
const operator = {
  name: template.name,
  account_id: "a".repeat(32),
  main: "/old-recovery/source.mjs",
  vars: { PRIVATE_VALUE: "synthetic-do-not-copy" },
  ai: { binding: "AI" },
  d1_databases: [
    {
      binding: "DB",
      database_name: "wilo-push",
      database_id: "00000000-0000-0000-0000-000000000001",
    },
  ],
  queues: {
    producers: [{ binding: "PUSH_QUEUE", queue: "wilo-push" }, {binding:"EXISTING_OTHER_QUEUE",queue:"existing-other"}],
    consumers: [{ queue: "wilo-push", max_concurrency: 1 }],
  },
};
it("release policy comes from reviewed source while existing IDs/bindings stay intact and vars are omitted", () => {
  const config = workerReleaseConfig(template, operator, "/official");
  expect(config.queues.consumers[0].max_concurrency).toBe(2);
  expect(config.queues.consumers[0].dead_letter_queue).toBe("wilo-push-failed");
  expect(config.queues.producers).toEqual(operator.queues.producers);
  expect(config.d1_databases).toEqual(operator.d1_databases);
  expect(config.ai).toEqual(operator.ai);
  expect(config.keep_vars).toBe(true);
  expect(config.main).toBe("/official/push-worker/src/index.mjs");
  expect(JSON.stringify(config)).not.toContain("synthetic-do-not-copy");
});
it("wrong project/resource identity cannot silently reroute a production release", () => {
  expect(() =>
    workerReleaseConfig(
      template,
      { ...operator, name: "unrelated" },
      "/official",
    ),
  ).toThrow();
  expect(() =>
    workerReleaseConfig(
      template,
      {
        ...operator,
        queues: { producers: [{ binding: "PUSH_QUEUE", queue: "another" }] },
      },
      "/official",
    ),
  ).toThrow();
});

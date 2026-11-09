import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
/** Preserve operator-owned resource IDs; apply reviewed policy, never old vars or source paths. */
export function workerReleaseConfig(template, operator, root) {
  if (
    operator.name !== template.name ||
    !/^[a-f0-9]{32}$/.test(operator.account_id || "")
  )
    throw Error("Wrong Worker deployment identity");
  const db = operator.d1_databases?.find((item) => item.binding === "DB"),
    target = template.d1_databases.find((item) => item.binding === "DB");
  if (
    !db ||
    db.database_name !== target.database_name ||
    !/^[a-f0-9-]{36}$/.test(db.database_id)
  )
    throw Error("Missing or mismatched D1 metadata");
  const queue = template.queues.producers.find(
    (item) => item.binding === "PUSH_QUEUE",
  );
  if (
    operator.queues?.producers?.find((item) => item.binding === "PUSH_QUEUE")
      ?.queue !== queue.queue
  )
    throw Error("Refusing queue rerouting");
  const config = {
    ...operator,
    ...template,
    account_id: operator.account_id,
    d1_databases: operator.d1_databases,
    main: resolve(root, "push-worker/src/index.mjs"),
    keep_vars: true,
  };
  const reviewed = template.queues.consumers.find(
    (item) => item.queue === queue.queue,
  );
  if (!operator.queues.consumers?.some((item) => item.queue === queue.queue))
    throw Error("Missing existing queue consumer");
  config.queues = {
    ...operator.queues,
    ...template.queues,
    producers: operator.queues.producers,
    consumers: operator.queues.consumers.map((item) =>
      item.queue === queue.queue ? { ...item, ...reviewed } : item,
    ),
  };
  delete config.vars;
  return config;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const root = fileURLToPath(new URL("../", import.meta.url));
  try {
    const template = JSON.parse(
        readFileSync(resolve(root, "push-worker/wrangler.jsonc"), "utf8"),
      ),
      operator = JSON.parse(
        readFileSync(resolve(root, ".wrangler/production-worker.json"), "utf8"),
      );
    writeFileSync(
      resolve(root, ".wrangler/reviewed-worker.json"),
      JSON.stringify(workerReleaseConfig(template, operator, root), null, 2) +
        "\n",
      { mode: 0o600 },
    );
    console.log(
      "Prepared official Worker code and reviewed queue policy; existing resource IDs and remote variables preserved.",
    );
  } catch {
    console.error(
      "Worker release preparation failed. Verify ignored production metadata and existing Worker/D1/queue identity; credentials were not printed.",
    );
    process.exitCode = 1;
  }
}

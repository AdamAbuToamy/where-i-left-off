import { createRequire } from "node:module";
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
const require = createRequire(
    new URL("../push-worker/package.json", import.meta.url),
  ),
  { build } = require("esbuild"),
  run = promisify(execFile);
const root = fileURLToPath(new URL("..", import.meta.url));
const { outputFiles } = await build({
  entryPoints: [root + "/src/apiDocs/contract.ts"],
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
});
const docs = await import(
  "data:text/javascript;base64," +
    Buffer.from(outputFiles[0].text).toString("base64")
);
const source = await readFile(root + "/docs/openapi-public-api.json", "utf8");
if (process.argv.includes("--published")) {
  const response = await fetch(
    "https://where-i-left-off.web.app/openapi-public-api.json",
    { signal: AbortSignal.timeout(15000) },
  );
  assert.equal(response.status, 200);
  assert.equal(await response.text(), source);
}
const captured = [];
let forcedStatus = 0;
const server = createServer(async (req, res) => {
  let text = "";
  for await (const chunk of req) text += chunk;
  assert.equal(req.headers.authorization, "Bearer " + docs.placeholder);
  const path = req.url.split("?")[0].replace(/^\/api\/v1/, "");
  const op = docs.operations.find(
    (o) =>
      o.method === req.method &&
      new RegExp("^" + o.path.replace(/\{[^}]+\}/g, "[^/]+") + "$").test(path),
  );
  assert.ok(op, "Undocumented operation");
  if (op.parameters.some((p) => p.name === "Idempotency-Key"))
    assert.match(
      req.headers["idempotency-key"],
      /^[A-Za-z0-9][A-Za-z0-9_.:-]{15,127}$/,
    );
  if (op.requestBody) {
    assert.match(req.headers["content-type"], /application\/json/);
    captured.push({ operationId: op.id, body: JSON.parse(text) });
  }
  res.setHeader("content-type", "application/json");
  res.setHeader("cache-control", "no-store");
  if (forcedStatus) {
    res.statusCode = forcedStatus;
    res.setHeader("Retry-After", "60");
    res.end(
      JSON.stringify({
        error: "synthetic-error",
        requestId: "synthetic-request",
      }),
    );
    return;
  }
  res.statusCode = req.method === "POST" && op.responses["201"] ? 201 : 200;
  const result =
    req.method === "GET"
      ? {
          items: [
            {
              id: "SYNTHETIC_COURSE",
              name: "Synthetic local course",
              revision: 0,
            },
          ],
          nextCursor: null,
        }
      : { id: "SYNTHETIC_RESOURCE", revision: 0, created: true };
  res.end(JSON.stringify({ result, requestId: "synthetic-request" }));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = "http://127.0.0.1:" + server.address().port + "/api/v1";
async function execute(code, language) {
  const local = code
    .replaceAll(docs.apiBase, base)
    .replaceAll("REPLACE_WITH_COURSE_ID_FROM_RESPONSE", "SYNTHETIC_COURSE");
  const args =
    language === "curl"
      ? ["bash", ["-e", "-c", local]]
      : language === "python"
        ? ["python3", ["-c", local]]
        : [process.execPath, ["--input-type=module", "-e", local]];
  return run(args[0], args[1], {
    env: { ...process.env, WILO_API_KEY: docs.placeholder },
    timeout: 10000,
    maxBuffer: 100000,
  });
}
try {
  for (const language of ["curl", "python", "javascript"]) {
    for (const op of docs.operations)
      await execute(docs.requestCode(op, language), language);
    await execute(docs.workflowCode(language), language);
    for (const status of [401, 403, 429]) {
      forcedStatus = status;
      await assert.rejects(
        execute(
          docs.requestCode(
            docs.operations.find((o) => o.operationId === "listCourses"),
            language,
          ),
          language,
        ),
      );
    }
    forcedStatus = 0;
  }
  // Python jsonschema/requests are existing local verification tools, not application dependencies.
  const validation = String.raw`import json,sys,jsonschema
payload=json.loads(sys.argv[1]);contract=payload['contract']
for item in payload['captured']:
    op=next(op for path in contract['paths'].values() for method,op in path.items() if method in ['post','patch','put'] and op['operationId']==item['operationId'])
    schema=op['requestBody']['content']['application/json']['schema']
    jsonschema.Draft202012Validator(dict(schema,components=contract['components'])).validate(item['body'])
print(len(payload['captured']))`;
  const result = await run(
    "python3",
    [
      "-c",
      validation,
      JSON.stringify({ contract: JSON.parse(source), captured }),
    ],
    { timeout: 10000 },
  ).catch((error) => {
    throw new Error("OpenAPI validation failed: " + error.stderr.slice(-1500));
  });
  console.log(
    `Passed ${docs.operations.length * 3} generated request examples, 3 workflows, 9 HTTP error handling cases; ${result.stdout.trim()} captured JSON bodies validated against OpenAPI. Local synthetic server only.`,
  );
} finally {
  await new Promise((resolve) => server.close(resolve));
}

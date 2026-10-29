/** Real browser-owned transfer, using legal synthetic bytes or pinned local model files.
 * A local HTTP mirror changes transport only. No account access or inference is performed.
 */
import { chromium } from "@playwright/test";
import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { readFile, writeFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { SESSION_SPEECH_FILES } from "../src/session/speechModel.ts";
const root = fileURLToPath(new URL("..", import.meta.url)),
  real = process.argv.includes("--real-model");
const fixtureSize = 1024 * 1024,
  partSize = 512 * 1024;
const inputs = real
  ? SESSION_SPEECH_FILES
  : [0, 1].map((index) => ({
      file: `test-${index}.onnx`,
      size: fixtureSize,
      parts: [0, partSize].map((start) => ({
        start,
        end: start + partSize - 1,
        size: partSize,
        range: `bytes=${start}-${start + partSize - 1}`,
        sha256: createHash("sha256")
          .update(Buffer.alloc(partSize, 7))
          .digest("hex"),
      })),
    }));
if (real)
  for (const asset of inputs)
    if (
      (
        await stat(
          resolve(
            root,
            ".wrangler/session-voice-audio/turbo-model/onnx",
            asset.file,
          ),
        )
      ).size !== asset.size
    )
      throw Error("Pinned local model assets required");
const total = inputs.reduce((sum, asset) => sum + asset.size, 0);
let bytes = 0,
  source = "",
  completion;
const core = await readFile(
  resolve(root, "public/speech-install-core.js"),
  "utf8",
);
const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, HEAD, OPTIONS",
  "access-control-allow-headers": "Range",
  "access-control-expose-headers": "Content-Range, Content-Length",
  "access-control-allow-private-network": "true",
};
const assets = createServer((request, response) => {
  if (request.method === "OPTIONS") {
    response.writeHead(204, cors);
    response.end();
    return;
  }
  const url = new URL(request.url, "http://localhost"),
    asset = inputs.find((file) => url.pathname === "/" + file.file),
    range = /^bytes=([0-9]+)-([0-9]+)$/.exec(request.headers.range || "");
  if (!asset || !range) {
    response.writeHead(400, cors);
    response.end();
    return;
  }
  const start = Number(range[1]),
    end = Number(range[2]);
  if (
    start < 0 ||
    end >= asset.size ||
    end < start ||
    Number(url.searchParams.get("wilo-part")) !== start
  ) {
    response.writeHead(416, cors);
    response.end();
    return;
  }
  response.writeHead(206, {
    ...cors,
    "content-type": "application/octet-stream",
    "content-length": end - start + 1,
    "content-range": `bytes ${start}-${end}/${asset.size}`,
  });
  if (real) {
    const stream = createReadStream(
      resolve(
        root,
        ".wrangler/session-voice-audio/turbo-model/onnx",
        asset.file,
      ),
      { start, end, highWaterMark: 1024 * 1024 },
    );
    stream.on("data", (chunk) => {
      bytes += chunk.length;
    });
    stream.pipe(response);
    response.on("close", () => stream.destroy());
  } else {
    let sent = 0;
    const timer = setInterval(() => {
      const chunk = Buffer.alloc(Math.min(16384, end - start + 1 - sent), 7);
      response.write(chunk);
      sent += chunk.length;
      bytes += chunk.length;
      if (sent === end - start + 1) {
        clearInterval(timer);
        response.end();
      }
    }, 20);
    response.on("close", () => clearInterval(timer));
  }
});
const app = createServer((request, response) => {
  if (request.url === "/__install-status") {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      completion = JSON.parse(body);
      response.end("ok");
    });
    return;
  }
  const script =
    request.url === "/sw.js"
      ? source
      : request.url === "/speech-install-core.js"
        ? core
        : null;
  response.writeHead(200, {
    "content-type": script !== null ? "text/javascript" : "text/html",
  });
  response.end(
    script ??
      "<!doctype html><title>Wilo model download verification</title><button>Download model</button>",
  );
});
await Promise.all([
  new Promise((resolve) => app.listen(0, "127.0.0.1", resolve)),
  new Promise((resolve) => assets.listen(0, "127.0.0.1", resolve)),
]);
const origin = `http://localhost:${app.address().port}`,
  assetOrigin = `http://localhost:${assets.address().port}`;
const files = inputs.map((asset) => {
    const url = assetOrigin + "/" + asset.file;
    return {
      ...asset,
      url,
      parts: asset.parts.map((part) => ({
        ...part,
        url: url + "?wilo-part=" + part.start,
      })),
    };
  }),
  id = "wilo-model-download-verification";
source = (await readFile(resolve(root, "public/sw.js"), "utf8"))
  .replace(
    "const SPEECH_INSTALL = null;",
    "const SPEECH_INSTALL = " + JSON.stringify({ id, files }) + ";",
  )
  .replace(
    "async function speechInstallNotice(error) {",
    "async function speechInstallNotice(error) { await fetch('/__install-status',{method:'POST',body:JSON.stringify({error})});",
  );
const browser = await chromium.launch({
  headless: true,
  channel: process.env.TEST_CHROMIUM_PATH ? undefined : "chromium",
  ...(process.env.TEST_CHROMIUM_PATH
    ? { executablePath: process.env.TEST_CHROMIUM_PATH }
    : {}),
  args: ["--no-sandbox"],
});
try {
  const context = await browser.newContext(),
    page = await context.newPage();
  await page.goto(origin);
  await (
    await context.newCDPSession(page)
  ).send("Browser.grantPermissions", {
    origin,
    permissions: ["backgroundFetch"],
  });
  await page.evaluate(
    async ({ id, files }) => {
      await navigator.serviceWorker.register("/sw.js");
      const registration = await navigator.serviceWorker.ready;
      if (!registration.backgroundFetch)
        throw Error("Background Fetch is not supported");
      document.querySelector("button").onclick = async () => {
        try {
          await registration.backgroundFetch.fetch(
            id,
            files.flatMap((asset) =>
              asset.parts.map(
                (part) =>
                  new Request(part.url, {
                    mode: "cors",
                    credentials: "omit",
                    headers: { Range: part.range },
                  }),
              ),
            ),
            {
              title: "Wilo speech model",
              downloadTotal: files.reduce((sum, file) => sum + file.size, 0),
            },
          );
          window.started = true;
        } catch (error) {
          window.failure = String(error);
        }
      };
    },
    { id, files },
  );
  await page.getByRole("button").click();
  await page.waitForFunction(() => window.started || window.failure);
  const failed = await page.evaluate(() => window.failure);
  if (failed) throw Error(failed);
  await page.close();
  const bytesAtClose = bytes;
  if (bytesAtClose >= total)
    throw Error("Page did not close before transfer completed");
  const start = Date.now();
  while (!completion) {
    if (Date.now() - start > 120000)
      throw Error("Background install timed out; bytes served " + bytes);
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (completion.error)
    throw Error(
      "The service worker could not verify and commit all model parts",
    );
  const reopened = await context.newPage();
  await reopened.goto(origin);
  const persisted = await reopened.evaluate(async (files) => {
    const directory = await (
      await navigator.storage.getDirectory()
    ).getDirectoryHandle("wilo-speech-model-v1");
    const result = [];
    for (const asset of files) {
      const key = Array.from(
        new Uint8Array(
          await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(asset.url),
          ),
        ),
        (byte) => byte.toString(16).padStart(2, "0"),
      ).join("");
      const file = await (
          await directory.getFileHandle(key + ".data")
        ).getFile(),
        metadata = JSON.parse(
          await (
            await (await directory.getFileHandle(key + ".json")).getFile()
          ).text(),
        );
      result.push({ size: file.size, committed: metadata.size === file.size });
    }
    return result;
  }, files);
  if (
    persisted.some(
      (file, index) => file.size !== inputs[index].size || !file.committed,
    )
  )
    throw Error("Saved model verification failed");
  const result = {
    date: new Date().toISOString(),
    passed: true,
    realPinnedModelWeights: real,
    modelBytes: total,
    bytesServed: bytes,
    bytesAtPageClose: bytesAtClose,
    closedAllPagesUntilCommitted: true,
    crossOrigin: true,
    verifiedRangeParts: files.reduce((sum, file) => sum + file.parts.length, 0),
    elapsedMs: Date.now() - start,
    transport:
      "local HTTP mirror; real browser Background Fetch, SHA-256 validation and OPFS commit",
    files: persisted,
  };
  await writeFile(
    resolve(
      root,
      ".wrangler",
      real ? "speech-background-real.json" : "speech-background-fixture.json",
    ),
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
  app.closeAllConnections();
  assets.closeAllConnections();
  await Promise.all([
    new Promise((resolve) => app.close(resolve)),
    new Promise((resolve) => assets.close(resolve)),
  ]);
}

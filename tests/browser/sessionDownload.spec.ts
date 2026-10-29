import { test, expect } from "@playwright/test";
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
test.use({ serviceWorkers: "allow", channel: "chromium" });
test("browser-owned speech download finishes and commits its files after the initiating page closes", async ({
  page,
  context,
}) => {
  test.setTimeout(45000);
  const size = 1024 * 1024,
    partSize = 512 * 1024,
    core = await readFile("public/speech-install-core.js", "utf8");
  let source = "",
    bytes = 0;
  const server = createServer((request, response) => {
    if (request.url === "/speech-install-core.js") {
      response.writeHead(200, { "content-type": "text/javascript" });
      response.end(core);
      return;
    }
    if (request.url === "/sw.js") {
      response.writeHead(200, { "content-type": "text/javascript" });
      response.end(source);
      return;
    }
    if (request.url?.startsWith("/weight-")) {
      const range = /^bytes=([0-9]+)-([0-9]+)$/.exec(
        request.headers.range || "",
      );
      if (!range) {
        response.writeHead(400);
        response.end();
        return;
      }
      const start = Number(range[1]),
        end = Number(range[2]),
        length = end - start + 1;
      response.writeHead(206, {
        "content-type": "application/octet-stream",
        "content-length": length,
        "content-range": `bytes ${start}-${end}/${size}`,
      });
      let sent = 0;
      const timer = setInterval(() => {
        const chunk = Buffer.alloc(Math.min(16384, length - sent), 7);
        response.write(chunk);
        sent += chunk.length;
        bytes += chunk.length;
        if (sent === length) {
          clearInterval(timer);
          response.end();
        }
      }, 30);
      response.on("close", () => clearInterval(timer));
      return;
    }
    response.writeHead(200, { "content-type": "text/html" });
    response.end(
      "<!doctype html><title>Background download fixture</title><button>Download test weights</button>",
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = "http://127.0.0.1:" + (server.address() as AddressInfo).port,
    id = "wilo-speech-background-test";
  const files = ["a", "b"].map((name) => {
    const url = origin + "/weight-" + name + ".onnx";
    return {
      url,
      size,
      parts: [0, partSize].map((start) => ({
        url: url + "?wilo-part=" + start,
        start,
        end: start + partSize - 1,
        size: partSize,
        range: `bytes=${start}-${start + partSize - 1}`,
        sha256: createHash("sha256")
          .update(Buffer.alloc(partSize, 7))
          .digest("hex"),
      })),
    };
  });
  source = (await readFile("public/sw.js", "utf8")).replace(
    "const SPEECH_INSTALL = null;",
    "const SPEECH_INSTALL = " + JSON.stringify({ id, files }) + ";",
  );
  try {
    await page.goto(origin);
    const supported = await page.evaluate(async () => {
      await navigator.serviceWorker.register("/sw.js");
      const registration = await navigator.serviceWorker.ready;
      return "backgroundFetch" in registration;
    });
    test.skip(
      !supported,
      "This browser does not implement Background Fetch. The foreground fallback is reported separately.",
    );
    const cdp = await context.newCDPSession(page);
    await cdp.send("Browser.grantPermissions", {
      origin,
      permissions: ["backgroundFetch"],
    });
    await page.evaluate(
      async ({ id, files }) => {
        const registration = (await navigator.serviceWorker
          .ready) as ServiceWorkerRegistration & {
          backgroundFetch: {
            fetch: (
              id: string,
              urls: Request[],
              options: { title: string; downloadTotal: number },
            ) => Promise<unknown>;
          };
        };
        const state = window as typeof window & {
          downloadStarted?: boolean;
          downloadFailure?: string;
        };
        document.querySelector("button")!.onclick = async () => {
          try {
            await registration.backgroundFetch.fetch(
              id,
              files.flatMap((file) =>
                file.parts.map(
                  (part) =>
                    new Request(part.url, { headers: { Range: part.range } }),
                ),
              ),
              {
                title: "Wilo background test",
                downloadTotal: files.reduce((sum, file) => sum + file.size, 0),
              },
            );
            state.downloadStarted = true;
          } catch (error) {
            state.downloadFailure = String(error);
          }
        };
      },
      { id, files },
    );
    await page.getByRole("button").click();
    await page.waitForFunction(() => {
      const state = window as typeof window & {
        downloadStarted?: boolean;
        downloadFailure?: string;
      };
      return state.downloadStarted || state.downloadFailure;
    });
    expect(
      await page.evaluate(
        () =>
          (window as typeof window & { downloadFailure?: string })
            .downloadFailure,
      ),
    ).toBeUndefined();
    await page.close();
    expect(bytes).toBeLessThan(size * 2);
    const reopened = await context.newPage();
    await reopened.goto(origin);
    await expect
      .poll(
        () =>
          reopened.evaluate(async (files) => {
            try {
              const directory = await (
                await navigator.storage.getDirectory()
              ).getDirectoryHandle("wilo-speech-model-v1");
              const result = [];
              for (const asset of files) {
                const digest = await crypto.subtle.digest(
                  "SHA-256",
                  new TextEncoder().encode(asset.url),
                );
                const name = Array.from(new Uint8Array(digest), (value) =>
                  value.toString(16).padStart(2, "0"),
                ).join("");
                const file = await (
                  await directory.getFileHandle(name + ".data")
                ).getFile();
                const metadata = JSON.parse(
                  await (
                    await (
                      await directory.getFileHandle(name + ".json")
                    ).getFile()
                  ).text(),
                );
                const data = new Uint8Array(await file.arrayBuffer());
                result.push({
                  size: file.size,
                  committed: metadata.size === file.size,
                  first: data[0],
                  last: data.at(-1),
                });
              }
              return result;
            } catch {
              return [];
            }
          }, files),
        { timeout: 20000 },
      )
      .toEqual([
        { size, committed: true, first: 7, last: 7 },
        { size, committed: true, first: 7, last: 7 },
      ]);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

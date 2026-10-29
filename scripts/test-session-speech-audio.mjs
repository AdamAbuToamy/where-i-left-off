import { SESSION_SPEECH_MODEL } from "../src/session/speechModel.ts";
/** Opt-in ASR of legal audio through the actual production worker. No account or uploads. */
import { chromium } from "@playwright/test";
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { resolve, basename } from "node:path";
const root = resolve(".wrangler/session-voice-audio");
await mkdir(root, { recursive: true });
const workerFile = (await readdir("dist/assets")).find((file) =>
  /^speech\.worker-.*\.js$/.test(file),
);
if (!workerFile)
  throw new Error("Build the app before running the audio check");
const browser = await chromium.launch({
  headless: true,
  ...(process.env.TEST_CHROMIUM_PATH
    ? { executablePath: process.env.TEST_CHROMIUM_PATH }
    : {}),
  args: [
    "--no-sandbox",
    ...(process.env.SPEECH_TEST_GPU_HIGH_PERFORMANCE === "true"
      ? ["--force-high-performance-gpu"]
      : []),
  ],
});
const context = await browser.newContext({ ignoreHTTPSErrors: true });
const page = await context.newPage();
const writes = [];
page.on("request", (request) => {
  if (!["GET", "HEAD"].includes(request.method()))
    writes.push({ method: request.method(), url: request.url().split("?")[0] });
});
page.on("console", (message) => {
  if (message.type() === "error") console.error(message.text().slice(0, 180));
});
let sample = "ar_eg";
await page.route("**/voice-sample.wav", async (route) =>
  route.fulfill({
    contentType: "audio/wav",
    body: await readFile(resolve(root, sample + ".wav")),
  }),
);
// Optional transport mirror: identical pinned public model bytes, never a fake inference response.
const mirror = process.env.SPEECH_TEST_ASSET_MIRROR === "true";
if (mirror) {
  await page.route("https://huggingface.co/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname,
      marker = `/resolve/${SESSION_SPEECH_MODEL.revision}/`;
    if (!pathname.includes(marker))
      throw new Error("Unexpected model request " + pathname);
    const file = pathname.split(marker)[1];
    if (!/^(?:[\w.-]+\.json|onnx\/[\w.-]+\.onnx)$/.test(file))
      throw new Error("Unexpected model file");
    await route.fulfill({
      headers: { "access-control-allow-origin": "*" },
      contentType: file.endsWith(".json")
        ? "application/json"
        : "application/octet-stream",
      body: await readFile(
        resolve(
          root,
          SESSION_SPEECH_MODEL.id.endsWith("whisper-large-v3-turbo")
            ? "turbo-model"
            : SESSION_SPEECH_MODEL.id.endsWith("small")
              ? "small-model"
              : "model",
          file,
        ),
      ),
    });
  });
  await page.route(
    "https://cdn.jsdelivr.net/npm/onnxruntime-web@*/dist/*",
    async (route) => {
      const file = basename(new URL(route.request().url()).pathname);
      if (!/^ort-[\w.-]+\.(?:wasm|mjs)$/.test(file))
        throw new Error("Unexpected runtime file");
      await route.fulfill({
        headers: { "access-control-allow-origin": "*" },
        contentType: file.endsWith(".mjs")
          ? "text/javascript"
          : "application/wasm",
        body: await readFile(
          resolve("node_modules/onnxruntime-web/dist", file),
        ),
      });
    },
  );
}
const normalize = (text) =>
  text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\p{M}/gu, "")
    .replace(/[\p{P}\p{S}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
function distance(a, b) {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i++) {
    const next = [i + 1];
    for (let j = 0; j < b.length; j++)
      next.push(
        Math.min(next[j] + 1, row[j + 1] + 1, row[j] + (a[i] === b[j] ? 0 : 1)),
      );
    row = next;
  }
  return row[b.length];
}
function errors(reference, text) {
  const a = normalize(reference),
    b = normalize(text);
  return {
    wer: distance(a.split(" "), b.split(" ")) / a.split(" ").length,
    cer: distance([...a], [...b]) / a.length,
  };
}
const results = [];
try {
  await page.route("**/voice-audio-check", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>Local speech test</title>",
    }),
  );
  await page.goto(
    (process.env.SPEECH_TEST_URL || "http://127.0.0.1:5185") +
      "/voice-audio-check",
  );
  await page.evaluate(async () => {
    await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise((resolve) =>
        navigator.serviceWorker.addEventListener("controllerchange", resolve, {
          once: true,
        }),
      );
  });
  for (const [name, language] of [
    ["ar_eg", "ar"],
    ["he_il", "he"],
    ["en_us", "en"],
    ["command-ar", "ar"],
    ["command-he", "he"],
    ["command-en", "en"],
    ["command-mixed", "ar"],
  ]) {
    sample = name;
    const reference = JSON.parse(
      await readFile(resolve(root, name + "-row.json"), "utf8"),
    ).rows[0].row.transcription;
    const result = await page.evaluate(
      async ({ language, workerFile }) => {
        const worker = new Worker("/assets/" + workerFile, { type: "module" });
        let count = 0;
        const waiting = new Map();
        worker.onmessage = (event) => {
          const m = event.data;
          if (["loaded", "final", "error"].includes(m.type)) {
            const pending = waiting.get(m.requestId);
            waiting.delete(m.requestId);
            m.type === "error"
              ? pending.reject(new Error(m.code))
              : pending.resolve(m.text || "");
          }
        };
        worker.onerror = () => {
          for (const p of waiting.values())
            p.reject(new Error("speech-worker"));
        };
        const request = (type, data) =>
          new Promise((resolve, reject) => {
            const requestId = String(++count);
            waiting.set(requestId, { resolve, reject });
            worker.postMessage({ type, requestId, ...data });
          });
        const start = performance.now(),
          timeout = setTimeout(() => {
            for (const p of waiting.values())
              p.reject(new Error("audio-test-timeout"));
            worker.terminate();
          }, 240000);
        try {
          await request("load", { language });
          const loadMs = Math.round(performance.now() - start);
          const bytes = await (await fetch("/voice-sample.wav")).arrayBuffer(),
            audio = new AudioContext({ sampleRate: 16000 }),
            decoded = await audio.decodeAudioData(bytes),
            samples = decoded.getChannelData(0).slice();
          await audio.close();
          const started = performance.now(),
            text = await request("transcribe", { audio: samples.slice() }),
            inferenceMs = Math.round(performance.now() - started);
          const rms = Math.sqrt(
            samples.reduce((sum, x) => sum + x * x, 0) / samples.length,
          );
          let seed = 42;
          const noisy = samples.map((x) => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return Math.max(
              -1,
              Math.min(
                1,
                x + ((seed / 4294967296 - 0.5) * Math.sqrt(12) * rms) / 10,
              ),
            );
          });
          const noiseStart = performance.now(),
            noiseText = await request("transcribe", { audio: noisy });
          return {
            text,
            loadMs,
            inferenceMs,
            noise: {
              snrDb: 20,
              kind: "deterministic added white noise",
              text: noiseText,
              inferenceMs: Math.round(performance.now() - noiseStart),
            },
          };
        } catch (error) {
          return {
            error: error.message,
            elapsedMs: Math.round(performance.now() - start),
          };
        } finally {
          clearTimeout(timeout);
          worker.terminate();
        }
      },
      { language, workerFile },
    );
    results.push({
      sample: name,
      language,
      kind: name.startsWith("command-") ? "synthetic-OS-voice" : "human-FLEURS",
      reference,
      ...result,
      ...(result.text
        ? {
            errors: errors(reference, result.text),
            noiseErrors: errors(reference, result.noise.text),
          }
        : {}),
    });
    console.log(JSON.stringify(results.at(-1)));
  }
  // Disable all fixture interception first. Offline reload must really use browser caches.
  await page.unroute("https://huggingface.co/**");
  await page.unroute("https://cdn.jsdelivr.net/npm/onnxruntime-web@*/dist/*");
  await context.setOffline(true);
  const cache = await page.evaluate(async (workerFile) => {
    const worker = new Worker("/assets/" + workerFile, { type: "module" });
    try {
      return await new Promise((resolve) => {
        const timer = setTimeout(
          () => resolve({ loadedOffline: false, error: "timeout" }),
          120000,
        );
        worker.onerror = () => {
          clearTimeout(timer);
          resolve({ loadedOffline: false, error: "worker" });
        };
        worker.onmessage = (e) => {
          if (["loaded", "error"].includes(e.data.type)) {
            clearTimeout(timer);
            resolve({
              loadedOffline: e.data.type === "loaded",
              error: e.data.code,
            });
          }
        };
        worker.postMessage({
          type: "load",
          requestId: "offline",
          language: "en",
        });
      });
    } finally {
      worker.terminate();
    }
  }, workerFile);
  await writeFile(
    resolve(root, "results.json"),
    JSON.stringify(
      {
        date: new Date().toISOString(),
        kind: "real-audio-production-worker",
        model: SESSION_SPEECH_MODEL,
        assetTransport: mirror
          ? "local-mirror-of-pinned-public-files"
          : "public-network",
        results,
        cache,
        nonGetRequests: writes,
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ cache, writes }));
  if (
    results.some((result) => result.error) ||
    !cache.loadedOffline ||
    writes.length
  )
    process.exitCode = 1;
} finally {
  await browser.close();
}

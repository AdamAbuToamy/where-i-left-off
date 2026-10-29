import { SESSION_SPEECH_MODEL } from "../../src/session/speechModel";
import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve, basename } from "node:path";
import { setup } from "./sessionVoice.helpers";
// Historical opt-in proof belongs to the previous local-model release.
// The active cloud adapter is covered separately; do not report a local run as cloud evidence.
test.skip(
  true,
  "Legacy local-model audio journey; session recording now uses browser cloud recognition",
);
const file = process.env.SPEECH_TEST_REAL_MIC_FILE;
test.use({
  serviceWorkers: "block",
  permissions: ["microphone"],
  launchOptions: {
    ...(process.env.TEST_CHROMIUM_PATH
      ? { executablePath: process.env.TEST_CHROMIUM_PATH }
      : {}),
    args: [
      "--no-sandbox",
      ...(process.env.SPEECH_TEST_GPU_HIGH_PERFORMANCE === "true"
        ? ["--force-high-performance-gpu"]
        : []),
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
      ...(file ? ["--use-file-for-fake-audio-capture=" + resolve(file)] : []),
    ],
  },
});
test("real local dictation goes through microphone, domain, Firestore and reload", async ({
  page,
}) => {
  test.skip(
    !file,
    "Opt-in: supply a generated local command WAV and pinned model assets",
  );
  test.setTimeout(120000);
  await page.route("https://huggingface.co/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname,
      marker = `/resolve/${SESSION_SPEECH_MODEL.revision}/`;
    if (!pathname.includes(marker)) throw new Error("Unpinned speech asset");
    const name = pathname.split(marker)[1];
    if (!/^(?:[\w.-]+\.json|onnx\/[\w.-]+\.onnx)$/.test(name))
      throw new Error("Unexpected speech asset");
    if (process.env.SPEECH_TEST_MIRROR_ORIGIN) {
      await route.fulfill({
        status: 307,
        headers: {
          "access-control-allow-origin": "*",
          location:
            process.env.SPEECH_TEST_MIRROR_ORIGIN +
            "/.wrangler/session-voice-audio/turbo-model/" +
            name,
        },
      });
      return;
    }
    await route.fulfill({
      headers: { "access-control-allow-origin": "*" },
      body: await readFile(
        resolve(
          ".wrangler/session-voice-audio/" +
            (SESSION_SPEECH_MODEL.id.endsWith("whisper-large-v3-turbo")
              ? "turbo-model"
              : SESSION_SPEECH_MODEL.id.endsWith("small")
                ? "small-model"
                : "model"),
          name,
        ),
      ),
    });
  });
  await page.route(
    "https://cdn.jsdelivr.net/npm/onnxruntime-web@*/dist/*",
    async (route) => {
      const name = basename(new URL(route.request().url()).pathname);
      await route.fulfill({
        contentType: name.endsWith(".wasm")
          ? "application/wasm"
          : "text/javascript",
        headers: { "access-control-allow-origin": "*" },
        body: await readFile(
          resolve("node_modules/onnxruntime-web/dist", name),
        ),
      });
    },
  );
  await page.addInitScript(() => {
    const testing = window as typeof window & {
      wiloVoiceTracks: MediaStreamTrack[];
      wiloVoiceWorkers: { terminated: boolean }[];
    };
    testing.wiloVoiceTracks = [];
    testing.wiloVoiceWorkers = [];
    const capture = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    navigator.mediaDevices.getUserMedia = async (options) => {
      const stream = await capture(options);
      testing.wiloVoiceTracks.push(...stream.getTracks());
      return stream;
    };
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      private receipt: { terminated: boolean } | null = null;
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        if (String(url).includes("speech.worker")) {
          this.receipt = { terminated: false };
          testing.wiloVoiceWorkers.push(this.receipt);
        }
      }
      terminate() {
        if (this.receipt) this.receipt.terminated = true;
        super.terminate();
      }
    };
  });
  await setup(page);
  const supported = await page.evaluate(async () => {
    const gpu = (
      navigator as Navigator & {
        gpu?: {
          requestAdapter: (options: { powerPreference: string }) => Promise<{
            features: { has: (name: string) => boolean };
          } | null>;
        };
      }
    ).gpu;
    const adapter = await gpu?.requestAdapter({
      powerPreference: "high-performance",
    });
    return !!adapter?.features.has("shader-f16");
  });
  test.skip(
    !supported,
    "The stronger local model requires a real WebGPU device; do not replace inference with a mock here.",
  );
  const panel = page.locator(".session-workspace");
  await panel
    .getByRole("button", { name: "Download speech model", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Save draft and close", exact: true })
    .click();
  await expect(page.locator(".focus-dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Work session", exact: true }).click();

  await expect(
    panel.getByRole("button", { name: "Record voice message", exact: true }),
  ).toBeEnabled({ timeout: 60000 });
  await panel
    .getByRole("button", { name: "Record voice message", exact: true })
    .click();
  await expect(panel.locator("[data-microphone=active]")).toBeVisible({
    timeout: 30000,
  });
  // A voice message is captured completely before the model runs.
  await page.waitForTimeout(10000);
  await expect(panel.locator(".session-clip-draft")).toHaveCount(0);
  await panel
    .getByRole("button", { name: "Stop and transcribe", exact: true })
    .click();
  await expect(
    panel.getByLabel("Review recording", { exact: true }),
  ).toHaveValue(/check.*authentication/i, { timeout: 60000 });
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const testing = window as typeof window & {
            wiloVoiceTracks: MediaStreamTrack[];
            wiloVoiceWorkers: { terminated: boolean }[];
          };
          return {
            tracksStopped:
              testing.wiloVoiceTracks.length > 0 &&
              testing.wiloVoiceTracks.every(
                (track) => track.readyState === "ended",
              ),
            workersTerminated:
              testing.wiloVoiceWorkers.length > 0 &&
              testing.wiloVoiceWorkers.every((worker) => worker.terminated),
          };
        }),
      { timeout: 30000 },
    )
    .toEqual({ tracksStopped: true, workersTerminated: false });
  await expect(panel.locator("[data-session-item]")).toHaveCount(0);
  await expect(panel.locator("[data-session-note]")).toHaveCount(0);
  await expect(panel.locator(".session-transcript-paragraph")).toHaveCount(0);
  await panel
    .getByRole("button", { name: "Approve and save", exact: true })
    .click();
  await expect(panel.locator(".session-clip-draft")).toHaveCount(0);
  await expect(panel.locator("[data-session-sync=ready]")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Work session", exact: true }).click();
  await expect(
    panel.locator(".session-transcript-paragraph").first(),
  ).toHaveValue(/check.*authentication/i);
  await expect(panel.locator("[data-microphone=off]")).toBeVisible();
  // A second worker must reuse model weights with all Hugging Face requests blocked.
  await page.unroute("https://huggingface.co/**");
  await page.route("https://huggingface.co/**", (route) =>
    route.abort("internetdisconnected"),
  );
  await panel
    .getByRole("button", { name: "Record voice message", exact: true })
    .click();
  await expect(panel.locator("[data-microphone=active]")).toBeVisible({
    timeout: 30000,
  });
  await page.waitForTimeout(10000);
  await panel
    .getByRole("button", { name: "Stop and transcribe", exact: true })
    .click();
  await expect(
    panel.getByLabel("Review recording", { exact: true }),
  ).toBeVisible({ timeout: 60000 });
  await panel
    .getByRole("button", { name: "Discard recording", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Save draft and close", exact: true })
    .click();
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const state = window as typeof window & {
            wiloVoiceWorkers: { terminated: boolean }[];
          };
          return (
            state.wiloVoiceWorkers.length > 0 &&
            state.wiloVoiceWorkers.every((worker) => worker.terminated)
          );
        }),
      { timeout: 30000 },
    )
    .toBe(true);
});

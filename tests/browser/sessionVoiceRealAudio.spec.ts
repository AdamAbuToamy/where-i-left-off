import { SESSION_SPEECH_MODEL } from "../../src/session/speechModel";
import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve, basename } from "node:path";
import { setup } from "./sessionVoice.helpers";
const file = process.env.SPEECH_TEST_REAL_MIC_FILE;
test.use({
  serviceWorkers: "block",
  permissions: ["microphone"],
  launchOptions: {
    args: [
      "--no-sandbox",
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
      ...(file ? ["--use-file-for-fake-audio-capture=" + resolve(file)] : []),
    ],
  },
});
test("real local ASR command goes through microphone, review, domain, Firestore and reload", async ({
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
    await route.fulfill({
      headers: { "access-control-allow-origin": "*" },
      body: await readFile(
        resolve(
          ".wrangler/session-voice-audio/" +
            (SESSION_SPEECH_MODEL.id.endsWith("small")
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
  const panel = page.locator(".session-workspace");
  await panel
    .getByRole("button", { name: "Start listening", exact: true })
    .click();
  await expect(panel.locator("[data-microphone=active]")).toBeVisible({
    timeout: 30000,
  });
  await expect(panel.locator(".session-proposal")).toBeVisible({
    timeout: 50000,
  });
  await panel
    .getByRole("button", { name: "Pause microphone", exact: true })
    .click();
  expect(
    await page.evaluate(() => {
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
  ).toEqual({ tracksStopped: true, workersTerminated: true });
  await expect(panel.locator("[data-session-item]")).toHaveCount(0);
  await panel
    .getByRole("button", { name: "Apply proposal", exact: true })
    .click();
  await expect(panel.locator("[data-session-item]")).toContainText(
    /check.*authentication/i,
  );
  await expect(panel.locator("[data-session-sync=ready]")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Work session", exact: true }).click();
  await expect(panel.locator("[data-session-item]")).toContainText(
    /check.*authentication/i,
  );
  await expect(panel.locator("[data-microphone=off]")).toBeVisible();
});

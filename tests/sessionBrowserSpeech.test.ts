// @vitest-environment jsdom
import { it, expect, vi, afterEach } from "vitest";
import { BrowserSpeech } from "../src/session/browserSpeech";
import { acquireLocalInference } from "../src/lib/localInferenceLease";
const workers: FakeWorker[] = [];
class FakeWorker {
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  terminate = vi.fn();
  last: Record<string, unknown> | null = null;
  constructor() {
    workers.push(this);
  }
  postMessage(message: Record<string, unknown>) {
    this.last = message;
  }
  reply(type: string, extra = {}) {
    this.onmessage?.({
      data: { type, requestId: this.last!.requestId, ...extra },
    });
  }
}
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
afterEach(() => {
  vi.unstubAllGlobals();
  workers.length = 0;
});
function setup() {
  vi.stubGlobal("Worker", FakeWorker);
  vi.stubGlobal("isSecureContext", true);
  return new BrowserSpeech();
}
it("keeps text/audio runtimes mutually exclusive and releases the worker after cancellation", async () => {
  const speech = setup(),
    abort = new AbortController(),
    load = speech.load("ar", () => {}, abort.signal);
  await tick();
  expect(workers).toHaveLength(1);
  await expect(acquireLocalInference("text")).rejects.toThrow(
    "local-inference-busy",
  );
  abort.abort();
  await expect(load).rejects.toThrow("speech-cancelled");
  expect(workers[0].terminate).toHaveBeenCalled();
  const release = await acquireLocalInference("text");
  release();
});
it("does not accept malformed model messages and cleans up on load failure", async () => {
  const speech = setup(),
    load = speech.load("en", () => {}, new AbortController().signal);
  await tick();
  workers[0].reply("error", { code: "speech-model-load" });
  await expect(load).rejects.toThrow("speech-model-load");
  expect(workers[0].terminate).toHaveBeenCalled();
  const release = await acquireLocalInference("speech");
  release();
});
it("uses partials only as display callbacks and returns validated final output", async () => {
  const speech = setup(),
    load = speech.load("he", () => {}, new AbortController().signal);
  await tick();
  workers[0].reply("loaded");
  await load;
  const partial = vi.fn(),
    result = speech.transcribe(
      "segment",
      new Float32Array(10),
      partial,
      new AbortController().signal,
    );
  workers[0].reply("partial", { text: "draft" });
  expect(partial).toHaveBeenCalledWith("draft");
  workers[0].reply("final", { text: "הוסף בדיקה לרשימה" });
  expect(await result).toBe("הוסף בדיקה לרשימה");
  speech.dispose();
});
it("releases the lease even if creating a Worker throws", async () => {
  const speech = setup();
  vi.stubGlobal(
    "Worker",
    class {
      constructor() {
        throw new Error("blocked");
      }
    },
  );
  await expect(
    speech.load("en", () => {}, new AbortController().signal),
  ).rejects.toThrow("speech-worker");
  const release = await acquireLocalInference("text");
  release();
});

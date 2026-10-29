import { it, expect, vi, beforeEach, afterEach } from "vitest";
import { MessageChannel } from "node:worker_threads";
import {
  SESSION_SPEECH_FILES,
  SESSION_SPEECH_DOWNLOAD_ID,
} from "../src/session/speechModel";
const saved = vi.hoisted(() => new Map<string, Response>());
vi.mock("../src/session/browserSpeech", () => ({
  requireSpeechGpu: async () => {},
}));
vi.mock("../src/session/speechAssetCache", () => ({
  createSpeechAssetCache: async () => ({
    match: async (url: string) => saved.get(url),
  }),
}));
beforeEach(() => {
  vi.resetModules();
  saved.clear();
  vi.stubGlobal("MessageChannel", MessageChannel);
  vi.stubGlobal("setInterval", () => undefined);
  vi.stubGlobal("caches", {
    open: async () => ({ match: async () => undefined }),
  });
});
afterEach(() => vi.unstubAllGlobals());
it("hands missing files to the browser-owned download and reuses completed weights", async () => {
  saved.set(
    SESSION_SPEECH_FILES[0].url,
    new Response("fixture", {
      headers: { "content-length": String(SESSION_SPEECH_FILES[0].size) },
    }),
  );
  const fetch = vi.fn(async (...args: unknown[]) => {
    void args;
    return {
      downloaded: 0,
      result: "",
      failureReason: "",
      addEventListener: vi.fn(),
    };
  });
  const registration = {
    active: {
      postMessage: (_message: unknown, ports: MessagePort[]) => {
        ports[0].postMessage({ id: SESSION_SPEECH_DOWNLOAD_ID });
        ports[0].close();
      },
    },
    backgroundFetch: { get: async () => undefined, fetch },
  };
  const worker = vi.fn();
  vi.stubGlobal("Worker", worker);
  vi.stubGlobal("navigator", {
    storage: { persist: async () => true },
    serviceWorker: {
      getRegistration: async () => registration,
      addEventListener: vi.fn(),
    },
  });
  const installer = await import("../src/session/speechDownload");
  await installer.startSpeechDownload();
  expect(fetch).toHaveBeenCalledOnce();
  expect(fetch.mock.calls[0][0]).toBe(SESSION_SPEECH_DOWNLOAD_ID);
  const requests = fetch.mock.calls[0][1] as Request[];
  expect(requests.map((request) => request.url)).toEqual(
    SESSION_SPEECH_FILES[1].parts.map((part) => part.url),
  );
  expect(
    requests.every(
      (request, index) =>
        request.headers.get("Range") ===
        SESSION_SPEECH_FILES[1].parts[index].range,
    ),
  ).toBe(true);
  expect(installer.speechDownloadSnapshot()).toMatchObject({
    stage: "downloading",
    background: true,
  });
  expect(worker).not.toHaveBeenCalled();
});
it("truthfully uses a page-owned installer when background fetch is unavailable", async () => {
  const created: unknown[] = [];
  class Worker {
    postMessage = vi.fn();
    terminate = vi.fn();
    constructor() {
      created.push(this);
    }
  }
  vi.stubGlobal("Worker", Worker);
  vi.stubGlobal("navigator", {
    storage: { persist: async () => true },
    serviceWorker: {
      getRegistration: async () => undefined,
      addEventListener: vi.fn(),
    },
  });
  const installer = await import("../src/session/speechDownload");
  await installer.startSpeechDownload();
  expect(created).toHaveLength(1);
  expect(installer.speechDownloadSnapshot()).toMatchObject({
    stage: "downloading",
    background: false,
  });
});

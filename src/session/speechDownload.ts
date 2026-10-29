import { requireSpeechGpu } from "./browserSpeech";
import { createSpeechAssetCache } from "./speechAssetCache";
import {
  SESSION_SPEECH_FILES,
  SESSION_SPEECH_DOWNLOAD_ID,
} from "./speechModel";
export type SpeechDownloadState = {
  stage: "checking" | "missing" | "downloading" | "saving" | "ready" | "error";
  loaded: number;
  total: number;
  background: boolean;
  error?: string;
};
type BackgroundJob = {
  downloaded: number;
  result: string;
  failureReason: string;
  recordsAvailable?: boolean;
  addEventListener: (name: string, listener: () => void) => void;
};
type BackgroundManager = {
  get: (id: string) => Promise<BackgroundJob | undefined>;
  fetch: (
    id: string,
    requests: Request[],
    options: { title: string; downloadTotal: number },
  ) => Promise<BackgroundJob>;
};
const total = SESSION_SPEECH_FILES.reduce((sum, asset) => sum + asset.size, 0);
let state: SpeechDownloadState = {
    stage: "checking",
    loaded: 0,
    total,
    background: false,
  },
  worker: Worker | null = null,
  starting = false,
  checking: Promise<void> | null = null,
  timer: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<() => void>();
function publish(change: Partial<SpeechDownloadState>) {
  state = { ...state, ...change };
  for (const listener of listeners) listener();
}
export const speechDownloadSnapshot = () => state;
export const subscribeSpeechDownload = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
async function registration() {
  return navigator.serviceWorker?.getRegistration("/") as
    | Promise<
        | (ServiceWorkerRegistration & { backgroundFetch?: BackgroundManager })
        | undefined
      >
    | undefined;
}
export function refreshSpeechDownload(): Promise<void> {
  if (checking) return checking;
  checking = (async () => {
    const cache = await createSpeechAssetCache();
    let saved = 0;
    const parts = await caches.open("wilo-speech-parts-v1");
    let installedBytes = 0;
    for (const asset of SESSION_SPEECH_FILES) {
      if (
        Number(
          (await cache.match(asset.url))?.headers.get("content-length"),
        ) === asset.size
      ) {
        saved += asset.size;
        installedBytes += asset.size;
        continue;
      }
      for (const part of asset.parts) {
        const response = await parts.match(part.url);
        if (
          Number(response?.headers.get("content-length")) === part.size &&
          response?.headers.get("x-wilo-sha256") === part.sha256
        )
          saved += part.size;
      }
    }
    if (installedBytes === total) {
      publish({ stage: "ready", loaded: total });
      if (timer) clearInterval(timer);
      timer = undefined;
      return;
    }
    const reg = await registration(),
      job = await reg?.backgroundFetch?.get(SESSION_SPEECH_DOWNLOAD_ID);
    if (
      job &&
      !job.failureReason &&
      !(job.result === "success" && job.recordsAvailable === false)
    ) {
      publish({
        stage: job.result === "success" ? "saving" : "downloading",
        background: true,
        loaded: Math.min(total, saved + job.downloaded),
      });
      monitor();
      return;
    }
    if (!worker)
      publish({
        stage: job ? "error" : "missing",
        loaded: saved,
        background: false,
      });
    if (timer) clearInterval(timer);
    timer = undefined;
  })()
    .catch(() => publish({ stage: "error" }))
    .finally(() => {
      checking = null;
    });
  return checking;
}
function monitor() {
  if (!timer) timer = setInterval(() => void refreshSpeechDownload(), 1500);
}
async function supportsManagedDownload(reg: ServiceWorkerRegistration) {
  return new Promise<boolean>((resolve) => {
    const channel = new MessageChannel();
    const finish = (ready: boolean) => {
      clearTimeout(timeout);
      channel.port1.close();
      resolve(ready);
    };
    const timeout = setTimeout(() => finish(false), 1000);
    channel.port1.onmessage = (event) =>
      finish(event.data?.id === SESSION_SPEECH_DOWNLOAD_ID);
    reg.active?.postMessage({ type: "wilo-speech-install-supported" }, [
      channel.port2,
    ]);
  });
}
async function settleWorker(reg: ServiceWorkerRegistration) {
  const candidate = reg.installing || reg.waiting;
  if (!candidate) return;
  publish({ stage: "checking" });
  await new Promise<void>((resolve) => {
    const finish = () => {
      clearTimeout(timeout);
      candidate.removeEventListener("statechange", changed);
      resolve();
    };
    const changed = () => {
      if (["activated", "redundant"].includes(candidate.state)) finish();
    };
    const timeout = setTimeout(finish, 5000);
    candidate.addEventListener("statechange", changed);
    changed();
  });
}
/** Installation belongs to the application, never to a microphone/dialog lifecycle. */
export async function startSpeechDownload() {
  if (starting || worker) return;
  starting = true;
  try {
    await requireSpeechGpu();
    void navigator.storage?.persist?.().catch(() => {});
    await refreshSpeechDownload();
    if (
      state.stage === "ready" ||
      (state.background && ["downloading", "saving"].includes(state.stage))
    )
      return;
    const cache = await createSpeechAssetCache(),
      missing = [];
    for (const asset of SESSION_SPEECH_FILES)
      if (
        Number(
          (await cache.match(asset.url))?.headers.get("content-length"),
        ) !== asset.size
      )
        missing.push(asset);
    const partCache = await caches.open("wilo-speech-parts-v1"),
      pending = [];
    for (const asset of missing)
      for (const part of asset.parts) {
        const response = await partCache.match(part.url);
        if (
          Number(response?.headers.get("content-length")) !== part.size ||
          response?.headers.get("x-wilo-sha256") !== part.sha256
        )
          pending.push(part);
      }
    const estimate = await navigator.storage?.estimate?.();
    const missingBytes = pending.reduce((sum, part) => sum + part.size, 0);
    const required =
      missingBytes +
      Math.max(0, ...missing.map((asset) => asset.size)) +
      64 * 1024 * 1024;
    const backgroundFits =
      estimate?.quota === undefined ||
      estimate.usage === undefined ||
      estimate.quota - estimate.usage >= required + missingBytes;
    if (
      estimate?.quota !== undefined &&
      estimate.usage !== undefined &&
      estimate.quota - estimate.usage < required
    )
      throw new Error("speech-cache");
    const reg = await registration();
    if (reg?.backgroundFetch) await settleWorker(reg);
    if (
      backgroundFits &&
      pending.length &&
      reg?.active &&
      reg.backgroundFetch &&
      (await supportsManagedDownload(reg))
    ) {
      try {
        const existing = await reg.backgroundFetch.get(
          SESSION_SPEECH_DOWNLOAD_ID,
        );
        if (existing && !existing.failureReason) {
          monitor();
          return;
        }
        const job = await reg.backgroundFetch.fetch(
          SESSION_SPEECH_DOWNLOAD_ID,
          pending.map(
            (part) =>
              new Request(part.url, {
                mode: "cors",
                credentials: "omit",
                headers: { Range: part.range },
              }),
          ),
          {
            title: "Wilo · Speech model",
            downloadTotal: pending.reduce((sum, part) => sum + part.size, 0),
          },
        );
        publish({
          stage: "downloading",
          background: true,
          loaded: state.loaded + job.downloaded,
        });
        monitor();
        return;
      } catch {
        const existing = await reg.backgroundFetch
          .get(SESSION_SPEECH_DOWNLOAD_ID)
          .catch(() => undefined);
        if (existing && !existing.failureReason) {
          publish({ stage: "downloading", background: true });
          monitor();
          return;
        } /* Unsupported or denied downloads use a page-owned worker. */
      }
    }
    publish({ stage: "downloading", background: false });
    worker = new Worker(
      new URL("./speechDownload.worker.ts", import.meta.url),
      { type: "module" },
    );
    const done = async (failed: boolean) => {
      worker?.terminate();
      worker = null;
      if (checking) await checking;
      await refreshSpeechDownload();
      if (failed && state.stage !== "ready") publish({ stage: "error" });
    };
    worker.onmessage = (event) => {
      if (event.data.type === "progress")
        publish({
          stage: event.data.stage === "saving" ? "saving" : "downloading",
          loaded: Math.min(total, event.data.loaded),
        });
      else void done(event.data.type !== "ready");
    };
    worker.onerror = () => void done(true);
    worker.postMessage({ type: "download" });
  } catch (error) {
    publish({
      stage: "error",
      error:
        error instanceof Error &&
        ["speech-gpu-required", "speech-cache"].includes(error.message)
          ? error.message
          : "speech-download",
    });
  } finally {
    starting = false;
  }
}

if (typeof navigator !== "undefined" && navigator.serviceWorker)
  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data?.type !== "wilo-speech-install") return;
    if (event.data.error && state.background && !worker) {
      if (timer) clearInterval(timer);
      timer = undefined;
      publish({ stage: "error" });
    } else void refreshSpeechDownload();
  });

import { SESSION_SPEECH_MODEL } from "./speechModel";
import { acquireLocalInference } from "../lib/localInferenceLease";
import { createClientId } from "../lib/clientId";
import type { SpeechPort, SpeechProgress } from "./speechTypes";
import type { Language } from "../translations";
/** Model assets may be downloaded; audio/text stay in the dedicated local worker. */
export class BrowserSpeech implements SpeechPort {
  private worker: Worker | null = null;
  private release: (() => void) | null = null;
  private pending = new Map<
    string,
    {
      resolve: (text: string) => void;
      reject: (error: Error) => void;
      partial?: (text: string) => void;
      progress?: (value: SpeechProgress) => void;
      cleanup: () => void;
    }
  >();
  private async request(
    type: "load" | "transcribe",
    data: Record<string, unknown>,
    signal: AbortSignal,
    progress?: (value: SpeechProgress) => void,
    partial?: (text: string) => void,
  ) {
    signal.throwIfAborted();
    const requestId = createClientId();
    return new Promise<string>((resolve, reject) => {
      const abort = () => {
        signal.removeEventListener("abort", abort);
        this.pending.delete(requestId);
        reject(new Error("speech-cancelled"));
      };
      signal.addEventListener("abort", abort, { once: true });
      this.pending.set(requestId, {
        resolve,
        reject,
        progress,
        partial,
        cleanup: () => signal.removeEventListener("abort", abort),
      });
      try {
        this.worker!.postMessage(
          { type, requestId, ...data },
          data.audio instanceof Float32Array ? [data.audio.buffer] : [],
        );
      } catch {
        abort();
      }
    });
  }
  async load(
    language: Language,
    progress: (value: SpeechProgress) => void,
    signal: AbortSignal,
  ) {
    if (typeof Worker === "undefined" || !globalThis.isSecureContext)
      throw new Error("speech-unsupported");
    if (SESSION_SPEECH_MODEL.requiresWebGPU) {
      const gpu = (
        navigator as Navigator & {
          gpu?: {
            requestAdapter: (options: { powerPreference: string }) => Promise<{
              features: { has: (feature: string) => boolean };
            } | null>;
          };
        }
      ).gpu;
      const adapter = await gpu?.requestAdapter({
        powerPreference: "high-performance",
      });
      if (!adapter?.features.has("shader-f16"))
        throw new Error("speech-gpu-required");
    }
    this.release = await acquireLocalInference("speech");
    if (signal.aborted) {
      this.release();
      this.release = null;
      throw new Error("speech-cancelled");
    }
    try {
      this.worker = new Worker(new URL("./speech.worker.ts", import.meta.url), {
        type: "module",
      });
    } catch {
      this.dispose();
      throw new Error("speech-worker");
    }
    const files = new Map<string, { loaded: number; total: number }>();
    this.worker.onmessage = (event) => {
      const message = event.data;
      if (
        !message ||
        typeof message !== "object" ||
        typeof message.requestId !== "string"
      )
        return;
      const pending = this.pending.get(message.requestId);
      if (!pending) return;
      if (message.type === "partial") {
        if (typeof message.text === "string")
          pending.partial?.(message.text.slice(0, 1000));
        return;
      }
      if (message.type === "progress") {
        if (
          Number.isFinite(message.loaded) &&
          Number.isFinite(message.total) &&
          message.total > 0
        ) {
          files.set(String(message.file), {
            loaded: Math.max(0, Math.min(message.loaded, message.total)),
            total: message.total,
          });
          const assets = [...files.values()];
          pending.progress?.({
            loaded: assets.reduce((sum, file) => sum + file.loaded, 0),
            total: assets.reduce((sum, file) => sum + file.total, 0),
            file: String(message.file),
          });
        }
        return;
      }
      pending.cleanup();
      this.pending.delete(message.requestId);
      if (message.type === "error")
        pending.reject(
          new Error(
            typeof message.code === "string" ? message.code : "speech-error",
          ),
        );
      else if (message.type === "loaded") pending.resolve("");
      else if (
        message.type === "final" &&
        typeof message.text === "string" &&
        message.text.length <= 1000
      )
        pending.resolve(message.text);
      else pending.reject(new Error("speech-invalid-response"));
    };
    this.worker.onerror = () => {
      for (const pending of this.pending.values()) {
        pending.cleanup();
        pending.reject(new Error("speech-worker"));
      }
      this.pending.clear();
    };
    try {
      void navigator.storage?.persist?.().catch(() => {});
    } catch {
      /* A browser may decline persistence. */
    }
    try {
      await this.request("load", { language }, signal, progress);
    } catch (error) {
      this.dispose();
      throw error;
    }
  }
  async transcribe(
    _id: string,
    audio: Float32Array,
    partial: (text: string) => void,
    signal: AbortSignal,
  ) {
    return this.request("transcribe", { audio }, signal, undefined, partial);
  }
  dispose() {
    this.worker?.terminate();
    this.worker = null;
    for (const pending of this.pending.values()) {
      pending.cleanup();
      pending.reject(new Error("speech-cancelled"));
    }
    this.pending.clear();
    this.release?.();
    this.release = null;
  }
}

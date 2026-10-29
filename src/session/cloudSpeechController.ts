import type { Language } from "../translations";
import type { SessionState } from "./domain";
import type { SpokenSegment } from "./commands";
import type { SpeechEvent } from "./speechController";
export type CloudRecognitionEvents = {
  started: () => void;
  result: (text: string) => void;
  ended: () => void;
  failed: (code: string) => void;
};
export interface CloudRecognitionPort {
  start(events: CloudRecognitionEvents): void;
  stop(): void;
  abort(): void;
}
type Options = {
  recognition: (language: Language) => CloudRecognitionPort;
  current: () => SessionState;
  language: Language;
  now: () => number;
  newId: () => string;
  changed: (event: SpeechEvent) => void;
  final: (segment: SpokenSegment) => void;
};
/** Browser cloud recognition is buffered until stop; persistence remains explicit. */
export class CloudSessionSpeechController {
  private readonly options: Options;
  private voice: CloudRecognitionPort | null = null;
  private generation = 0;
  private recording = false;
  private chunks: string[] = [];
  private text = "";
  private restarts = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private deadline: ReturnType<typeof setTimeout> | undefined;
  private completing: Promise<void> | null = null;
  private complete: (() => void) | null = null;
  private snapshot: Pick<
    SpokenSegment,
    "id" | "sessionId" | "revision" | "order" | "at"
  > | null = null;
  constructor(options: Options) {
    this.options = options;
  }
  get hasPendingAudio() {
    return this.text.length > 0 || this.chunks.length > 0;
  }
  start() {
    if (this.recording || this.completing) return;
    void this.stop();
    const state = this.options.current();
    this.snapshot = {
      id: this.options.newId(),
      sessionId: state.id,
      revision: state.contentRevision,
      order: state.items.map((item) => item.id),
      at: this.options.now(),
    };
    this.recording = true;
    this.restarts = 0;
    this.options.changed({ stage: "loading", microphone: false });
    this.begin(this.generation);
  }
  private begin(generation: number) {
    try {
      const voice = this.options.recognition(this.options.language);
      this.voice = voice;
      if (!this.timer && !this.deadline)
        this.deadline = setTimeout(
          () => this.publish("speech-cloud-service"),
          10000,
        );
      voice.start({
        started: () => {
          if (generation !== this.generation) {
            voice.abort();
            return;
          }
          clearTimeout(this.deadline);
          this.deadline = undefined;
          if (!this.timer)
            this.timer = setTimeout(() => void this.finish(), 24000);
          this.options.changed({ stage: "listening", microphone: true });
        },
        result: (text) => {
          if (generation === this.generation) this.text = text;
        },
        ended: () => {
          if (generation !== this.generation) return;
          if (this.recording && ++this.restarts <= 5) {
            if (this.text.trim()) this.chunks.push(this.text.trim());
            this.text = "";
            this.begin(generation);
          } else
            this.publish(this.recording ? "speech-cloud-service" : undefined);
        },
        failed: (code) => {
          if (generation !== this.generation || code === "no-speech") return;
          this.recording = false;
          this.voice = null;
          voice.abort();
          this.publish(
            code === "not-allowed" || code === "service-not-allowed"
              ? "speech-permission"
              : code === "network"
                ? "speech-cloud-network"
                : "speech-cloud-service",
          );
        },
      });
    } catch (error) {
      this.publish(
        error instanceof Error && error.message === "speech-cloud-unsupported"
          ? error.message
          : "speech-cloud-service",
      );
    }
  }
  finish(keepModel?: boolean): Promise<void> {
    void keepModel; // Compatibility with the session handle; no local model is retained.
    if (this.completing) return this.completing;
    if (!this.voice) return Promise.resolve();
    this.recording = false;
    this.options.changed({ stage: "processing", microphone: false });
    this.completing = new Promise((resolve) => {
      this.complete = resolve;
    });
    const task = this.completing;
    this.deadline = setTimeout(
      () => this.publish("speech-cloud-service"),
      4000,
    );
    try {
      this.voice.stop();
    } catch {
      this.publish();
    }
    return task;
  }
  private publish(error?: string) {
    const text = [...this.chunks, this.text].join(" ").trim();
    const snapshot = this.snapshot;
    this.cleanup();
    if (text && snapshot && text.length <= 1000)
      this.options.final({ ...snapshot, text, sequence: 1, final: true });
    this.options.changed({
      stage: error || !text || text.length > 1000 ? "error" : "paused",
      microphone: false,
      ...(error || !text || text.length > 1000
        ? {
            error:
              error ||
              (text.length > 1000
                ? "speech-output-limit"
                : "speech-cloud-empty"),
          }
        : {}),
    });
  }
  private cleanup() {
    this.generation++;
    this.recording = false;
    clearTimeout(this.timer);
    clearTimeout(this.deadline);
    this.timer = undefined;
    this.deadline = undefined;
    const voice = this.voice;
    this.voice = null;
    voice?.abort();
    this.text = "";
    this.chunks = [];
    const done = this.complete;
    this.complete = null;
    this.completing = null;
    done?.();
  }
  async pause() {
    this.cleanup();
    this.options.changed({ stage: "paused", microphone: false });
  }
  async stop() {
    await this.pause();
  }
  dispose() {
    this.cleanup();
  }
}

import type { Language } from "../translations";
import type { SessionState } from "./domain";
import type { SpokenSegment } from "./commands";
import type {
  MicrophonePort,
  SpeechPort,
  SpeechProgress,
  SpeechStage,
  AudioSegment,
} from "./speechTypes";
export type SpeechEvent = {
  stage: SpeechStage;
  microphone: boolean;
  partial?: string;
  progress?: SpeechProgress;
  error?: string;
};
type Options = {
  speech: () => SpeechPort;
  microphone: () => MicrophonePort;
  current: () => SessionState;
  language: Language;
  now: () => number;
  changed: (event: SpeechEvent) => void;
  final: (segment: SpokenSegment) => void;
  batchTranscription?: boolean;
};
/** Cancel by generation, serialize segments and cap backlog. Never executes operations. */
export class SessionSpeechController {
  private readonly options: Options;
  private generation = 0;
  private abort: AbortController | null = null;
  private speech: SpeechPort | null = null;
  private microphone: MicrophonePort | null = null;
  private snapshots = new Map<
    string,
    { sessionId: string; revision: number; order: string[] }
  >();
  private queue: AudioSegment[] = [];
  private submitted = new Set<string>();
  private processing = false;
  private drainTask: Promise<void> | null = null;
  private active = false;
  private modelReady = false;
  private disposed = false;
  constructor(options: Options) {
    this.options = options;
  }
  async start() {
    if (this.disposed) throw new Error("speech-cancelled");
    const warm =
      this.modelReady &&
      this.speech &&
      !this.active &&
      !this.processing &&
      !this.microphone;
    const stopped = warm ? Promise.resolve() : this.pause(),
      releasedGeneration = this.generation;
    await stopped;
    if (this.disposed || releasedGeneration !== this.generation) return;
    const generation = ++this.generation,
      abort = new AbortController();
    this.abort = abort;
    const speech = warm ? this.speech! : this.options.speech(),
      microphone = this.options.microphone();
    this.speech = speech;
    this.microphone = microphone;
    const stale = async () => {
      if (generation === this.generation) return false;
      speech.dispose();
      await microphone.stop();
      return true;
    };
    this.options.changed({ stage: "loading", microphone: false });
    try {
      if (
        typeof AbortSignal.any !== "function" ||
        typeof AbortSignal.timeout !== "function"
      )
        throw new Error("speech-unsupported");
      await microphone.prepare?.();
      if (await stale()) return;
      if (!warm)
        await speech.load(
          this.options.language,
          (progress) => {
            if (generation === this.generation)
              this.options.changed({
                stage: "loading",
                microphone: false,
                progress,
              });
          },
          AbortSignal.any([abort.signal, AbortSignal.timeout(600000)]),
        );
      if (await stale()) return;
      this.modelReady = true;
      await microphone.start(
        (id) => {
          if (generation !== this.generation) return;
          const queued = new Set(this.queue.map((segment) => segment.id));
          for (const key of this.snapshots.keys())
            if (!queued.has(key)) this.snapshots.delete(key);
          const state = this.options.current();
          this.snapshots.set(id, {
            sessionId: state.id,
            revision: state.contentRevision,
            order: state.items.map((item) => item.id),
          });
        },
        (segment) => {
          if (generation !== this.generation) {
            segment.audio.fill(0);
            return;
          }
          if (this.submitted.has(segment.id)) {
            segment.audio.fill(0);
            return;
          }
          this.submitted.add(segment.id);
          const tail = this.queue.at(-1);
          if (
            this.options.batchTranscription &&
            tail &&
            tail.sampleRate === segment.sampleRate &&
            tail.audio.length + segment.audio.length <= 448000 &&
            this.snapshots.get(tail.id)?.sessionId ===
              this.snapshots.get(segment.id)?.sessionId
          ) {
            const joined = new Float32Array(
              tail.audio.length + segment.audio.length,
            );
            joined.set(tail.audio);
            joined.set(segment.audio, tail.audio.length);
            tail.audio.fill(0);
            segment.audio.fill(0);
            tail.audio = joined;
            this.snapshots.delete(segment.id);
            return;
          }
          if (this.queue.length >= 2) {
            segment.audio.fill(0);
            void this.pause("speech-backlog");
            return;
          }
          this.queue.push(segment);
          void this.runDrain(generation);
        },
        (code) => {
          if (generation === this.generation) void this.pause(code);
        },
      );
      if (await stale()) return;
      this.active = true;
      this.options.changed({ stage: "listening", microphone: true });
    } catch (error) {
      if (await stale()) return;
      if (generation === this.generation)
        await this.pause(
          error instanceof Error
            ? error.name === "NotAllowedError"
              ? "speech-permission"
              : error.name === "NotFoundError" ||
                  error.name === "NotReadableError"
                ? "speech-no-device"
                : error.name === "NotSupportedError"
                  ? "speech-unsupported"
                  : error.name === "SecurityError"
                    ? "speech-permission"
                    : /^(speech-|local-inference-)/.test(error.message)
                      ? error.message
                      : "speech-error"
            : "speech-error",
        );
    }
  }
  private runDrain(generation: number): Promise<void> {
    if (this.processing) return this.drainTask || Promise.resolve();
    const task = this.drain(generation);
    this.drainTask = task;
    void task.finally(() => {
      if (this.drainTask === task) this.drainTask = null;
    });
    return task;
  }
  /** An explicit pause finishes captured words before releasing the local model. */
  async finish(keepModel = false) {
    const generation = this.generation,
      microphone = this.microphone;
    await microphone?.stop(true);
    if (generation !== this.generation) return;
    this.microphone = null;
    this.active = false;
    this.options.changed({
      stage: this.processing ? "processing" : "paused",
      microphone: false,
    });
    if (this.drainTask) await this.drainTask;
    if (generation === this.generation) {
      if (keepModel && this.modelReady && this.speech)
        this.options.changed({ stage: "paused", microphone: false });
      else await this.pause();
    }
  }
  private async drain(generation: number) {
    if (this.processing) return;
    this.processing = true;
    try {
      while (this.queue.length && generation === this.generation) {
        const segment = this.queue.shift()!,
          snapshot = this.snapshots.get(segment.id);
        this.snapshots.delete(segment.id);
        if (!snapshot) {
          segment.audio.fill(0);
          continue;
        }
        this.options.changed({
          stage: "processing",
          microphone: this.active,
          partial: "",
        });
        try {
          const signal = AbortSignal.any([
            this.abort!.signal,
            AbortSignal.timeout(60000),
          ]);
          const text = await this.speech!.transcribe(
            segment.id,
            segment.audio,
            (partial) => {
              if (generation === this.generation)
                this.options.changed({
                  stage: "processing",
                  microphone: this.active,
                  partial,
                });
            },
            signal,
          );
          if (generation !== this.generation) continue;
          if (text.trim())
            this.options.final({
              ...snapshot,
              id: segment.id,
              sequence: segment.sequence,
              text,
              at: segment.at || this.options.now(),
              final: true,
            });
        } finally {
          if (segment.audio.byteLength) segment.audio.fill(0);
        }
      }
      if (generation === this.generation)
        this.options.changed({ stage: "listening", microphone: this.active });
    } catch (error) {
      if (generation === this.generation)
        await this.pause(
          error instanceof Error ? error.message : "speech-error",
        );
    } finally {
      if (generation === this.generation) this.processing = false;
    }
  }
  async pause(error?: string) {
    this.generation++;
    this.abort?.abort();
    this.abort = null;
    this.active = false;
    this.processing = false;
    this.drainTask = null;
    for (const segment of this.queue) segment.audio.fill(0);
    this.queue = [];
    this.snapshots.clear();
    this.submitted.clear();
    this.modelReady = false;
    this.speech?.dispose();
    this.speech = null;
    const microphone = this.microphone;
    this.microphone = null;
    await microphone?.stop();
    if (!this.disposed)
      this.options.changed({
        stage: error ? "error" : "paused",
        microphone: false,
        ...(error ? { error } : {}),
      });
  }
  async stop() {
    await this.pause();
    if (!this.disposed)
      this.options.changed({ stage: "off", microphone: false });
  }
  dispose() {
    this.disposed = true;
    void this.pause();
  }
}

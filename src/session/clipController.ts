import type { Language } from "../translations";
import type { SessionState } from "./domain";
import type { SpokenSegment } from "./commands";
import type { SpeechPort, MicrophonePort, AudioSegment } from "./speechTypes";
import type { SpeechEvent } from "./speechController";
type Options = {
  speech: () => SpeechPort;
  microphone: () => MicrophonePort;
  current: () => SessionState;
  language: Language;
  now: () => number;
  changed: (event: SpeechEvent) => void;
  final: (segment: SpokenSegment) => void;
};
/** Capture first, transcribe only after stop. No inference queue and no persistence. */
export class SessionClipController {
  private microphone: MicrophonePort | null = null;
  private speech: SpeechPort | null = null;
  private ready = false;
  private generation = 0;
  private abort: AbortController | null = null;
  private clip: AudioSegment | null = null;
  private snapshot: Pick<
    SpokenSegment,
    "sessionId" | "revision" | "order"
  > | null = null;
  private finishing: Promise<void> | null = null;
  private readonly options: Options;
  constructor(options: Options) {
    this.options = options;
  }
  get hasPendingAudio() {
    return this.clip !== null;
  }
  async start() {
    if (this.finishing || this.microphone || this.clip) return;
    const generation = ++this.generation;
    const microphone = this.options.microphone();
    this.microphone = microphone;
    const current = this.options.current();
    this.snapshot = {
      sessionId: current.id,
      revision: current.contentRevision,
      order: current.items.map((item) => item.id),
    };
    this.options.changed({ stage: "loading", microphone: false });
    try {
      await microphone.prepare?.();
      if (generation !== this.generation) {
        await microphone.stop();
        return;
      }
      await microphone.start(
        () => {},
        (clip) => {
          if (generation !== this.generation) {
            clip.audio.fill(0);
            return;
          }
          this.clip = clip;
        },
        (code) => {
          if (generation !== this.generation) return;
          if (code === "speech-clip-limit") void this.finish(true);
          else void this.fail(code);
        },
      );
      if (generation !== this.generation) {
        await microphone.stop();
        return;
      }
      this.options.changed({ stage: "listening", microphone: true });
    } catch (error) {
      if (generation === this.generation)
        await this.fail(
          error instanceof Error && error.name === "NotAllowedError"
            ? "speech-permission"
            : "speech-no-device",
        );
    }
  }
  finish(keepModel = false): Promise<void> {
    if (this.finishing) return this.finishing;
    const task = this.finishClip(keepModel);
    this.finishing = task;
    void task.finally(() => {
      if (this.finishing === task) this.finishing = null;
    });
    return task;
  }
  private async finishClip(keepModel: boolean) {
    const generation = this.generation;
    const microphone = this.microphone;
    this.microphone = null;
    if (microphone) await microphone.stop(true);
    if (generation !== this.generation) return;
    const clip = this.clip;
    if (!clip || !clip.audio.length) {
      this.clip = null;
      if (!keepModel) this.releaseModel();
      this.options.changed({ stage: "paused", microphone: false });
      return;
    }
    this.options.changed({ stage: "processing", microphone: false });
    const abort = new AbortController();
    this.abort = abort;
    try {
      this.speech ??= this.options.speech();
      if (!this.ready) {
        await this.speech.load(
          this.options.language,
          (progress) => {
            if (generation === this.generation)
              this.options.changed({
                stage: "processing",
                microphone: false,
                progress,
              });
          },
          AbortSignal.any([abort.signal, AbortSignal.timeout(600000)]),
        );
        if (generation !== this.generation) return;
        this.ready = true;
      }
      if (generation !== this.generation) return;
      // BrowserSpeech transfers its buffer; retain the original for a failed attempt.
      const text = await this.speech.transcribe(
        clip.id,
        clip.audio.slice(),
        (partial) => {
          if (generation === this.generation)
            this.options.changed({
              stage: "processing",
              microphone: false,
              partial,
            });
        },
        AbortSignal.any([abort.signal, AbortSignal.timeout(120000)]),
      );
      if (generation !== this.generation) return;
      if (!text.trim()) throw new Error("speech-clip-empty");
      this.options.final({
        ...this.snapshot!,
        id: clip.id,
        sequence: 1,
        text,
        at: clip.at || this.options.now(),
        final: true,
      });
      clip.audio.fill(0);
      this.clip = null;
      if (!keepModel) this.releaseModel();
      this.options.changed({ stage: "paused", microphone: false });
    } catch (error) {
      if (generation !== this.generation) return;
      this.releaseModel();
      this.options.changed({
        stage: "error",
        microphone: false,
        error: error instanceof Error ? error.message : "speech-error",
      });
    }
  }
  private releaseModel() {
    this.speech?.dispose();
    this.speech = null;
    this.ready = false;
  }
  private async fail(code: string) {
    await this.pause();
    this.options.changed({ stage: "error", microphone: false, error: code });
  }
  async pause() {
    this.generation++;
    this.abort?.abort();
    this.abort = null;
    const microphone = this.microphone;
    this.microphone = null;
    this.clip?.audio.fill(0);
    this.clip = null;
    this.releaseModel();
    await microphone?.stop();
    this.options.changed({ stage: "paused", microphone: false });
  }
  async stop() {
    await this.pause();
  }
  dispose() {
    void this.pause();
  }
}

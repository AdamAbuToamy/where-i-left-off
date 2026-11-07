export type InteractionTone = "press" | "navigate" | "drop";
/** Browser boundary: synthesized short cues, no media downloads or microphone access. */
export class InteractionAudio {
  private context: AudioContext | null = null;
  private disposed = false;
  private last = -Infinity;
  private readonly create: () => AudioContext;
  constructor(create = () => new AudioContext()) {
    this.create = create;
  }
  async play(kind: InteractionTone) {
    if (this.disposed || performance.now() - this.last < 85) return;
    this.last = performance.now();
    try {
      const context = (this.context ||= this.create());
      if (context.state === "suspended") await context.resume();
      if (this.disposed || context.state !== "running") return;
      const tones =
        kind === "navigate" ? [440, 660] : kind === "drop" ? [330, 495] : [520];
      tones.forEach((frequency, index) => {
        const oscillator = context.createOscillator(),
          gain = context.createGain(),
          start = context.currentTime + index * 0.035;
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(frequency, start);
        oscillator.frequency.exponentialRampToValueAtTime(
          frequency * 0.8,
          start + 0.09,
        );
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.045, start + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.11);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.onended = () => {
          oscillator.disconnect();
          gain.disconnect();
        };
        oscillator.start(start);
        oscillator.stop(start + 0.12);
      });
    } catch {
      /* Unsupported/blocked audio must never block an app action. */
    }
  }
  dispose() {
    this.disposed = true;
    void this.context?.close().catch(() => {});
    this.context = null;
  }
}

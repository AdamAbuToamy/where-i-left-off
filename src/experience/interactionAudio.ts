export type InteractionTone = "press" | "navigate" | "drop" | "entry" | "guide";
/** Browser boundary: synthesized short cues, no media downloads or microphone access. */
export class InteractionAudio {
  private context: AudioContext | null = null;
  private disposed = false;
  private last = -Infinity;
  private readonly create: () => AudioContext;
  constructor(create = () => new AudioContext()) {
    this.create = create;
  }
  async unlock(): Promise<boolean> {
    if (this.disposed) return false;
    try {
      const context = (this.context ||= this.create());
      if (context.state === "suspended") await context.resume();
      return !this.disposed && context.state === "running";
    } catch {
      return false;
    }
  }
  async play(kind: InteractionTone) {
    if (this.disposed || performance.now() - this.last < 85) return;
    this.last = performance.now();
    try {
      if (!(await this.unlock()) || this.disposed || !this.context) return;
      const context = this.context;
      const entry = kind === "entry";
      const tones = entry
        ? [196, 293.66, 392]
        : kind === "guide"
          ? [587.33, 739.99]
          : kind === "navigate"
            ? [440, 660]
            : kind === "drop"
              ? [330, 495]
              : [520];
      tones.forEach((frequency, index) => {
        const oscillator = context.createOscillator(),
          gain = context.createGain(),
          start = context.currentTime + index * (entry ? 0.11 : 0.035);
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(frequency, start);
        oscillator.frequency.exponentialRampToValueAtTime(
          frequency * (entry ? 1.015 : 0.8),
          start + (entry ? 0.5 : 0.09),
        );
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(
          entry || kind === "guide" ? 0.025 : 0.045,
          start + (entry ? 0.035 : 0.008),
        );
        gain.gain.exponentialRampToValueAtTime(
          0.0001,
          start + (entry ? 0.65 : 0.11),
        );
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.onended = () => {
          oscillator.disconnect();
          gain.disconnect();
        };
        oscillator.start(start);
        oscillator.stop(start + (entry ? 0.68 : 0.12));
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

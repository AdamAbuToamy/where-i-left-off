/** Bounded silence segmentation at the worklet's fixed 16 kHz sample rate. */
export class AudioSegmenter {
  private before: Float32Array[] = [];
  private frames: Float32Array[] = [];
  private active = false;
  private voiced = 0;
  private silent = 0;
  private readonly start: () => void;
  private readonly complete: (audio: Float32Array) => void;
  constructor(start: () => void, complete: (audio: Float32Array) => void) {
    this.start = start;
    this.complete = complete;
  }
  push(frame: Float32Array) {
    if (frame.length > 6400) return;
    const rms = Math.sqrt(
        frame.reduce((sum, value) => sum + value * value, 0) /
          Math.max(1, frame.length),
      ),
      voiced = rms >= 0.012;
    if (!this.active) {
      this.before.push(frame.slice());
      if (this.before.length > 5) this.before.shift();
      if (!voiced) return;
      this.active = true;
      this.frames = this.before;
      this.before = [];
      this.start();
    } else this.frames.push(frame.slice());
    if (voiced) {
      this.voiced += frame.length;
      this.silent = 0;
    } else this.silent += frame.length;
    if (
      this.silent >= 12800 ||
      this.frames.reduce((sum, f) => sum + f.length, 0) >= 192000
    )
      this.finish();
  }
  finish() {
    if (this.voiced >= 3200) {
      const length = this.frames.reduce((sum, frame) => sum + frame.length, 0),
        audio = new Float32Array(length);
      let offset = 0;
      for (const frame of this.frames) {
        audio.set(frame, offset);
        offset += frame.length;
      }
      this.complete(audio);
    }
    this.clear();
  }
  clear() {
    for (const frame of [...this.before, ...this.frames]) frame.fill(0);
    this.before = [];
    this.frames = [];
    this.active = false;
    this.voiced = 0;
    this.silent = 0;
  }
}

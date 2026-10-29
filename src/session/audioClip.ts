/** A single bounded voice message. Silence never splits or drops its samples. */
export const CLIP_MAX_SAMPLES = 24 * 16000;
export class AudioClip {
  private frames: Float32Array[] = [];
  private size = 0;
  push(frame: Float32Array): boolean {
    const remaining = CLIP_MAX_SAMPLES - this.size;
    if (remaining > 0) {
      const copy = frame.slice(0, remaining);
      this.frames.push(copy);
      this.size += copy.length;
    }
    return this.size >= CLIP_MAX_SAMPLES;
  }
  finish(): Float32Array {
    const audio = new Float32Array(this.size);
    let offset = 0;
    for (const frame of this.frames) {
      audio.set(frame, offset);
      offset += frame.length;
    }
    this.clear();
    return audio;
  }
  clear() {
    for (const frame of this.frames) frame.fill(0);
    this.frames = [];
    this.size = 0;
  }
}

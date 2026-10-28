declare const sampleRate: number;
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
}
declare function registerProcessor(
  name: string,
  processor: typeof AudioWorkletProcessor,
): void;
/** Mono 16 kHz frames; no recording, networking or sound playback. */
class SessionAudioCapture extends AudioWorkletProcessor {
  private buffer = new Float32Array(640);
  private offset = 0;
  private phase = 0;
  private sum = 0;
  private count = 0;
  process(inputs: Float32Array[][], outputs: Float32Array[][]) {
    for (const output of outputs) for (const channel of output) channel.fill(0);
    const input = inputs[0]?.[0];
    if (!input) return true;
    for (const value of input) {
      this.sum += value;
      this.count++;
      this.phase += 16000;
      if (this.phase >= sampleRate) {
        this.phase -= sampleRate;
        this.buffer[this.offset++] = this.sum / this.count;
        this.sum = 0;
        this.count = 0;
        if (this.offset === this.buffer.length) {
          this.port.postMessage(this.buffer, [this.buffer.buffer]);
          this.buffer = new Float32Array(640);
          this.offset = 0;
        }
      }
    }
    return true;
  }
}
registerProcessor("wilo-session-capture", SessionAudioCapture);
export {};

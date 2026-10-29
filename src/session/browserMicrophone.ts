import captureWorkletUrl from "./audio.worklet.ts?worker&url";
import { AudioSegmenter } from "./audioSegments";
import { createClientId } from "../lib/clientId";
import type { AudioSegment, MicrophonePort } from "./speechTypes";
export class BrowserMicrophone implements MicrophonePort {
  private context: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private node: AudioWorkletNode | null = null;
  private segments: AudioSegmenter | null = null;
  private generation = 0;
  async prepare() {
    if (
      !globalThis.isSecureContext ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof AudioContext === "undefined"
    )
      throw new Error("speech-unsupported");
    try {
      this.context = new AudioContext({ sampleRate: 16000 });
    } catch (error) {
      if (error instanceof DOMException && error.name === "NotSupportedError")
        this.context = new AudioContext();
      else throw error;
    }
    // The worklet also resamples native-rate contexts on devices that reject 16 kHz.
    await this.context.resume();
    if (!this.context.audioWorklet) throw new Error("speech-unsupported");
  }
  async start(
    onStart: (id: string) => void,
    onSegment: (segment: AudioSegment) => void,
    onError: (code: string) => void,
  ) {
    const generation = ++this.generation;
    try {
      if (!this.context) await this.prepare();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      if (generation !== this.generation) {
        stream.getTracks().forEach((track) => track.stop());
        throw new Error("speech-cancelled");
      }
      this.stream = stream;
      for (const track of stream.getAudioTracks())
        track.onended = () => {
          if (generation === this.generation) onError("speech-device-lost");
        };
      const context = this.context!;
      await context.audioWorklet.addModule(captureWorkletUrl);
      if (generation !== this.generation) throw new Error("speech-cancelled");
      await context.resume();
      if (context.state !== "running")
        throw new Error("speech-audio-suspended");
      const capture = createClientId();
      let sequence = 0,
        id = "";
      this.segments = new AudioSegmenter(
        () => {
          id = capture + "-" + ++sequence;
          onStart(id);
        },
        (audio) =>
          onSegment({ id, sequence, audio, sampleRate: 16000, at: Date.now() }),
      );
      this.node = new AudioWorkletNode(context, "wilo-session-capture");
      this.node.port.onmessage = (event) => {
        if (
          generation === this.generation &&
          event.data instanceof Float32Array
        )
          this.segments?.push(event.data);
      };
      this.source = context.createMediaStreamSource(stream);
      this.source.connect(this.node);
      this.node.connect(context.destination);
    } catch (error) {
      await this.stop();
      throw error;
    }
  }
  async stop(flush = false) {
    if (flush) this.segments?.finish();
    this.generation++;
    this.segments?.clear();
    this.segments = null;
    if (this.node) {
      this.node.port.onmessage = null;
      this.node.disconnect();
      this.node.port.close();
      this.node = null;
    }
    this.source?.disconnect();
    this.source = null;
    this.stream?.getTracks().forEach((track) => {
      track.onended = null;
      track.stop();
    });
    this.stream = null;
    const context = this.context;
    this.context = null;
    if (context && context.state !== "closed")
      await context.close().catch(() => {});
  }
}

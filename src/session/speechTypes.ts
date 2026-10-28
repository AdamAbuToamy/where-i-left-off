import type { Language } from "../translations";
export type SpeechStage =
  | "off"
  | "loading"
  | "listening"
  | "processing"
  | "paused"
  | "error";
export type SpeechProgress = { loaded: number; total: number; file: string };
export interface SpeechPort {
  load(
    language: Language,
    progress: (value: SpeechProgress) => void,
    signal: AbortSignal,
  ): Promise<void>;
  transcribe(
    id: string,
    audio: Float32Array,
    partial: (text: string) => void,
    signal: AbortSignal,
  ): Promise<string>;
  dispose(): void;
}
export type AudioSegment = {
  id: string;
  sequence: number;
  audio: Float32Array;
  sampleRate: number;
  at: number;
};
export interface MicrophonePort {
  prepare?(): Promise<void>;
  start(
    onStart: (id: string) => void,
    onSegment: (segment: AudioSegment) => void,
    onError: (code: string) => void,
  ): Promise<void>;
  stop(): Promise<void>;
}

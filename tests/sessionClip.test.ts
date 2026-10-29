import { it, expect, vi } from "vitest";
import { AudioClip, CLIP_MAX_SAMPLES } from "../src/session/audioClip";
import { SessionClipController } from "../src/session/clipController";
import { emptySession } from "../src/session/domain";
import type {
  AudioSegment,
  MicrophonePort,
  SpeechPort,
} from "../src/session/speechTypes";
it("keeps every frame including silence and quiet words until explicit stop", () => {
  const clip = new AudioClip();
  for (const value of [0.001, 0, 0.02, 0, 0.003])
    clip.push(new Float32Array(16000).fill(value));
  const samples = clip.finish();
  expect(samples).toHaveLength(80000);
  expect(samples[0]).toBeCloseTo(0.001);
  expect(samples[79999]).toBeCloseTo(0.003);
  expect(clip.finish()).toHaveLength(0);
});
it("bounds a message explicitly at 24 seconds", () => {
  const clip = new AudioClip();
  expect(clip.push(new Float32Array(CLIP_MAX_SAMPLES - 1))).toBe(false);
  expect(clip.push(new Float32Array(10).fill(0.1))).toBe(true);
  expect(clip.finish()).toHaveLength(CLIP_MAX_SAMPLES);
});
function harness() {
  const audio = new Float32Array([0.01, 0, 0.02, 0.003]);
  const speech: SpeechPort = {
    load: vi.fn(async () => {}),
    transcribe: vi.fn(async () => "full message"),
    dispose: vi.fn(),
  };
  let emit!: (segment: AudioSegment) => void;
  const microphone: MicrophonePort = {
    start: vi.fn(async (_start, complete) => {
      emit = complete;
    }),
    stop: vi.fn(async (flush) => {
      if (flush)
        emit({
          id: "clip",
          sequence: 1,
          sampleRate: 16000,
          audio: audio.slice(),
          at: 10,
        });
    }),
  };
  const final = vi.fn();
  const changed = vi.fn();
  const controller = new SessionClipController({
    speech: () => speech,
    microphone: () => microphone,
    current: () =>
      emptySession({
        id: "session",
        projectId: "card",
        groupId: "",
        startedAt: 1,
      }),
    language: "ar",
    now: () => 10,
    changed,
    final,
  });
  return { controller, speech, microphone, audio, final, changed };
}
it("records before loading the model, then transcribes the complete stopped message once", async () => {
  const h = harness();
  await h.controller.start();
  expect(h.speech.load).not.toHaveBeenCalled();
  expect(h.speech.transcribe).not.toHaveBeenCalled();
  await h.controller.finish(true);
  expect(h.microphone.stop).toHaveBeenCalledWith(true);
  expect(h.speech.transcribe).toHaveBeenCalledOnce();
  expect(h.speech.transcribe).toHaveBeenCalledWith(
    "clip",
    h.audio,
    expect.any(Function),
    expect.any(AbortSignal),
  );
  expect(h.final).toHaveBeenCalledWith(
    expect.objectContaining({ text: "full message" }),
  );
  await h.controller.start();
  await h.controller.finish(true);
  expect(h.speech.load).toHaveBeenCalledOnce();
  h.controller.dispose();
  expect(h.speech.dispose).toHaveBeenCalledOnce();
});
it("retains the audio for retry after inference fails instead of losing the message", async () => {
  const h = harness();
  vi.mocked(h.speech.transcribe).mockRejectedValueOnce(
    new Error("speech-transcription"),
  );
  await h.controller.start();
  await h.controller.finish(true);
  expect(h.final).not.toHaveBeenCalled();
  await h.controller.finish(true);
  expect(h.speech.transcribe).toHaveBeenCalledTimes(2);
  expect(h.speech.transcribe).toHaveBeenLastCalledWith(
    "clip",
    h.audio,
    expect.any(Function),
    expect.any(AbortSignal),
  );
  expect(h.final).toHaveBeenCalledOnce();
  h.controller.dispose();
});

it("does not publish stale transcription after cancelling a clip", async () => {
  const h = harness();
  let resolve!: (text: string) => void;
  vi.mocked(h.speech.transcribe).mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  await h.controller.start();
  const finishing = h.controller.finish(true);
  await new Promise((done) => setTimeout(done, 0));
  await h.controller.stop();
  resolve("late words");
  await finishing;
  expect(h.final).not.toHaveBeenCalled();
  expect(h.controller.hasPendingAudio).toBe(false);
});

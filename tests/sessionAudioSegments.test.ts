import { it, expect, vi } from "vitest";
import { AudioSegmenter } from "../src/session/audioSegments";
it("ignores silence and brief clicks, emits bounded utterances, and clears on stop", () => {
  const start = vi.fn(),
    complete = vi.fn(),
    segmenter = new AudioSegmenter(start, complete),
    silence = new Float32Array(640),
    voice = new Float32Array(640).fill(0.1);
  for (let i = 0; i < 100; i++) segmenter.push(silence);
  expect(start).not.toHaveBeenCalled();
  segmenter.push(voice);
  for (let i = 0; i < 22; i++) segmenter.push(silence);
  expect(complete).not.toHaveBeenCalled();
  for (let i = 0; i < 8; i++) segmenter.push(voice);
  for (let i = 0; i < 20; i++) segmenter.push(silence);
  expect(complete).toHaveBeenCalledTimes(1);
  expect(complete.mock.calls[0][0].length).toBeLessThanOrEqual(96000);
  for (let i = 0; i < 310; i++) segmenter.push(voice);
  expect(complete).toHaveBeenCalledTimes(3);
  segmenter.clear();
  for (let i = 0; i < 20; i++) segmenter.push(silence);
  expect(complete).toHaveBeenCalledTimes(3);
});

it("flushes speech before trailing silence when the user explicitly finishes", () => {
  const final = vi.fn(),
    segmenter = new AudioSegmenter(() => {}, final);
  for (let i = 0; i < 8; i++) segmenter.push(new Float32Array(640).fill(0.1));
  segmenter.finish();
  expect(final).toHaveBeenCalledTimes(1);
  expect(final.mock.calls[0][0].length).toBe(5120);
  segmenter.finish();
  expect(final).toHaveBeenCalledTimes(1);
});

it("starts transcription after a short silence instead of waiting for a long recording", () => {
  const complete = vi.fn();
  const segmenter = new AudioSegmenter(() => {}, complete);
  for (let i = 0; i < 8; i++) segmenter.push(new Float32Array(640).fill(0.1));
  for (let i = 0; i < 11; i++) segmenter.push(new Float32Array(640));
  expect(complete).not.toHaveBeenCalled();
  segmenter.push(new Float32Array(640));
  expect(complete).toHaveBeenCalledOnce();
});

import { expect, it, vi } from "vitest";
import { InteractionAudio } from "../src/experience/interactionAudio";
function fakeAudio(state = "running") {
  const parameter = {
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  };
  const gain = { gain: parameter, connect: vi.fn(), disconnect: vi.fn() };
  const oscillator = {
    frequency: parameter,
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    onended: null,
  };
  const context = {
    state,
    currentTime: 0,
    destination: {},
    createOscillator: vi.fn(() => oscillator),
    createGain: vi.fn(() => gain),
    resume: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
  };
  return {
    context,
    oscillator,
    create: () => context as unknown as AudioContext,
  };
}
it("does not create audio until played and bounds rapidly repeated clicks", async () => {
  const audio = fakeAudio(),
    create = vi.fn(audio.create),
    player = new InteractionAudio(create);
  expect(create).not.toHaveBeenCalled();
  await player.play("press");
  await player.play("press");
  expect(create).toHaveBeenCalledTimes(1);
  expect(audio.context.createOscillator).toHaveBeenCalledTimes(1);
  expect(audio.oscillator.stop).toHaveBeenCalledWith(0.12);
  player.dispose();
  expect(audio.context.close).toHaveBeenCalledTimes(1);
  await player.play("navigate");
  expect(create).toHaveBeenCalledTimes(1);
});
it("never resumes a queued cue after the experience is disabled", async () => {
  const audio = fakeAudio("suspended");
  let release = () => {};
  audio.context.resume.mockImplementation(
    () =>
      new Promise<void>((done) => {
        release = done;
      }),
  );
  const player = new InteractionAudio(audio.create),
    playing = player.play("navigate");
  player.dispose();
  release();
  await playing;
  expect(audio.context.createOscillator).not.toHaveBeenCalled();
});
it("audio failure does not reject an app interaction", async () => {
  const player = new InteractionAudio(() => {
    throw new Error("unsupported");
  });
  await expect(player.play("drop")).resolves.toBeUndefined();
  player.dispose();
});

it("silently unlocks from a gesture and plays a bounded three-note entry cue", async () => {
  const audio = fakeAudio(),
    player = new InteractionAudio(audio.create);
  expect(await player.unlock()).toBe(true);
  expect(audio.oscillator.start).not.toHaveBeenCalled();
  await player.play("entry");
  expect(audio.context.createOscillator).toHaveBeenCalledTimes(3);
  expect(audio.oscillator.stop.mock.calls.at(-1)?.[0]).toBeCloseTo(0.9);
  player.dispose();
});

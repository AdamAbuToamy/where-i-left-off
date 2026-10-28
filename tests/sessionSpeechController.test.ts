import { it, expect, vi } from "vitest";
import { SessionSpeechController } from "../src/session/speechController";
import { emptySession } from "../src/session/domain";
import type {
  MicrophonePort,
  SpeechPort,
  AudioSegment,
} from "../src/session/speechTypes";
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
function harness() {
  let begin!: (id: string) => void, deliver!: (segment: AudioSegment) => void;
  const speech: SpeechPort = {
    load: vi.fn(async () => {}),
    transcribe: vi.fn(async (_id, _audio, partial) => {
      partial("partial");
      return "add task Firebase";
    }),
    dispose: vi.fn(),
  };
  const microphone: MicrophonePort = {
    start: vi.fn(async (a, b) => {
      begin = a;
      deliver = b;
    }),
    stop: vi.fn(async () => {}),
  };
  const final = vi.fn(),
    changed = vi.fn();
  let state = emptySession({
    id: "session",
    projectId: "card",
    groupId: "",
    startedAt: 1,
  });
  const controller = new SessionSpeechController({
    speech: () => speech,
    microphone: () => microphone,
    current: () => state,
    language: "ar",
    now: () => 100,
    final,
    changed,
  });
  return {
    controller,
    speech,
    microphone,
    final,
    changed,
    changeSession: () => {
      state = { ...state, id: "other" };
    },
    say: (id = "segment") => {
      begin(id);
      deliver({
        id,
        sequence: 1,
        audio: new Float32Array([0.1, 0.1]),
        at: 100,
        sampleRate: 16000,
      });
    },
  };
}
it("only emits finalized text and captures the session at the start of each utterance", async () => {
  const h = harness();
  await h.controller.start();
  h.say();
  await tick();
  expect(h.final).toHaveBeenCalledTimes(1);
  expect(h.final).toHaveBeenCalledWith(
    expect.objectContaining({
      final: true,
      sessionId: "session",
      text: "add task Firebase",
    }),
  );
  expect(h.changed).toHaveBeenCalledWith(
    expect.objectContaining({ partial: "partial" }),
  );
  h.controller.dispose();
  expect(h.speech.dispose).toHaveBeenCalled();
  expect(h.microphone.stop).toHaveBeenCalled();
});
it("suppresses late results after leaving the session and clears audio", async () => {
  const h = harness();
  let finish!: (text: string) => void;
  h.speech.transcribe = vi.fn(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await h.controller.start();
  h.say();
  h.changeSession();
  await h.controller.stop();
  finish("delete task login");
  await tick();
  expect(h.final).not.toHaveBeenCalled();
});
it.each([
  ["NotAllowedError", "speech-permission"],
  ["NotFoundError", "speech-no-device"],
  ["NotReadableError", "speech-no-device"],
  ["NotSupportedError", "speech-unsupported"],
  ["SecurityError", "speech-permission"],
])("shows %s and retains manual fallback", async (name, code) => {
  const h = harness();
  h.microphone.start = vi.fn(async () => {
    throw new DOMException("blocked", name);
  });
  await h.controller.start();
  expect(h.changed).toHaveBeenLastCalledWith({
    stage: "error",
    microphone: false,
    error: code,
  });
  expect(h.speech.dispose).toHaveBeenCalled();
  expect(h.microphone.stop).toHaveBeenCalled();
});
it("cleans resources on model download failure", async () => {
  const h = harness();
  h.speech.load = vi.fn(async () => {
    throw new Error("speech-model-load");
  });
  await h.controller.start();
  expect(h.microphone.start).not.toHaveBeenCalled();
  expect(h.speech.dispose).toHaveBeenCalled();
  expect(h.changed).toHaveBeenLastCalledWith({
    stage: "error",
    microphone: false,
    error: "speech-model-load",
  });
});
it("serializes inference and pauses when the bounded backlog is full", async () => {
  const h = harness();
  let finish!: (text: string) => void;
  h.speech.transcribe = vi.fn(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await h.controller.start();
  h.say("a");
  h.say("b");
  h.say("c");
  h.say("d");
  await tick();
  expect(h.speech.transcribe).toHaveBeenCalledTimes(1);
  expect(h.changed).toHaveBeenLastCalledWith({
    stage: "error",
    microphone: false,
    error: "speech-backlog",
  });
  finish("late");
  await tick();
  expect(h.final).not.toHaveBeenCalled();
});

it("a stop immediately after start prevents late microphone/model initialization", async () => {
  const h = harness();
  const start = h.controller.start();
  await h.controller.stop();
  await start;
  expect(h.speech.load).not.toHaveBeenCalled();
  expect(h.microphone.start).not.toHaveBeenCalled();
});
it("a superseded preparation cleans only its own ports and never loads the replacement twice", async () => {
  const state = emptySession({
    id: "session",
    projectId: "card",
    groupId: "",
    startedAt: 1,
  });
  let prepared!: () => void;
  const oldSpeech: SpeechPort = {
      load: vi.fn(async () => {}),
      transcribe: vi.fn(async () => ""),
      dispose: vi.fn(),
    },
    nextSpeech: SpeechPort = {
      load: vi.fn(async () => {}),
      transcribe: vi.fn(async () => ""),
      dispose: vi.fn(),
    };
  const oldMic: MicrophonePort = {
      prepare: () =>
        new Promise((resolve) => {
          prepared = resolve;
        }),
      start: vi.fn(async () => {}),
      stop: vi.fn(async () => {}),
    },
    nextMic: MicrophonePort = {
      start: vi.fn(async () => {}),
      stop: vi.fn(async () => {}),
    };
  let count = 0;
  const controller = new SessionSpeechController({
    speech: () => (++count === 1 ? oldSpeech : nextSpeech),
    microphone: () => (count === 1 ? oldMic : nextMic),
    current: () => state,
    language: "en",
    now: () => 1,
    changed: () => {},
    final: () => {},
  });
  const old = controller.start();
  await tick();
  await controller.start();
  prepared();
  await old;
  expect(oldSpeech.load).not.toHaveBeenCalled();
  expect(nextSpeech.load).toHaveBeenCalledTimes(1);
  expect(nextMic.start).toHaveBeenCalledTimes(1);
  expect(oldSpeech.dispose).toHaveBeenCalled();
  controller.dispose();
});

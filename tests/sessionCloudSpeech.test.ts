import { it, expect, vi, afterEach } from "vitest";
import { CloudSessionSpeechController } from "../src/session/cloudSpeechController";
import type {
  CloudRecognitionEvents,
  CloudRecognitionPort,
} from "../src/session/cloudSpeechController";
import { emptySession } from "../src/session/domain";
afterEach(() => vi.useRealTimers());
function harness() {
  const events: CloudRecognitionEvents[] = [];
  const ports: CloudRecognitionPort[] = [];
  const changed = vi.fn(),
    final = vi.fn();
  const controller = new CloudSessionSpeechController({
    language: "ar",
    now: () => 10,
    newId: () => "clip",
    current: () =>
      emptySession({
        id: "session",
        projectId: "card",
        groupId: "",
        startedAt: 1,
      }),
    recognition: () => {
      const p = {
        start: vi.fn((e: CloudRecognitionEvents) => {
          events.push(e);
          e.started();
        }),
        stop: vi.fn(() => events.at(-1)!.ended()),
        abort: vi.fn(),
      };
      ports.push(p);
      return p;
    },
    changed,
    final,
  });
  return { controller, events, ports, changed, final };
}
it("buffers cloud recognition without publishing a draft until explicit stop", async () => {
  const h = harness();
  h.controller.start();
  h.events[0].result("كل الكلام كامل");
  expect(h.final).not.toHaveBeenCalled();
  await h.controller.finish(true);
  expect(h.final).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ text: "كل الكلام كامل", sessionId: "session" }),
  );
  expect(h.ports[0].abort).toHaveBeenCalled();
});
it("restarts after service pause and keeps all phrases in their spoken order", async () => {
  const h = harness();
  h.controller.start();
  h.events[0].result("أول جملة");
  h.events[0].ended();
  h.events[1].result("ثاني جملة");
  await h.controller.finish();
  expect(h.final).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ text: "أول جملة ثاني جملة" }),
  );
});
it("keeps the latest interim hypothesis once, without duplicating replaced words", async () => {
  const h = harness();
  h.controller.start();
  h.events[0].result("أضف");
  h.events[0].result("أضف ملاحظة");
  await h.controller.finish();
  expect(h.final).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ text: "أضف ملاحظة" }),
  );
});
it("discards cancelled audio and ignores late events after account/session disposal", async () => {
  const h = harness();
  h.controller.start();
  h.events[0].result("discard");
  h.controller.dispose();
  h.events[0].result("late");
  h.events[0].ended();
  expect(h.final).not.toHaveBeenCalled();
  expect(h.controller.hasPendingAudio).toBe(false);
});
it("finishes after the visible 24-second message cap", async () => {
  vi.useFakeTimers();
  const h = harness();
  h.controller.start();
  h.events[0].result("message");
  await vi.advanceTimersByTimeAsync(24000);
  expect(h.final).toHaveBeenCalledOnce();
});
it("bounds a stalled service and exposes partial text only as a draft with an error", async () => {
  vi.useFakeTimers();
  const h = harness();
  h.controller.start();
  h.events[0].result("partial");
  h.events[0].failed("network");
  expect(h.changed).toHaveBeenLastCalledWith(
    expect.objectContaining({ stage: "error", error: "speech-cloud-network" }),
  );
  expect(h.final).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ text: "partial" }),
  );
});

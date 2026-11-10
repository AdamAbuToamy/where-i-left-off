// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { it, expect, vi } from "vitest";
const mock = vi.hoisted(() => ({
  unlock: vi.fn(async () => true),
  play: vi.fn(),
  dispose: vi.fn(),
}));
vi.mock("../src/experience/interactionAudio", () => ({
  InteractionAudio: class {
    unlock = mock.unlock;
    play = mock.play;
    dispose = mock.dispose;
  },
}));
import { useJourneyAudio } from "../src/components/useJourneyAudio";
import { saveExperience } from "../src/experience/preferences";
function Harness({ cue, active = true }: { cue: string; active?: boolean }) {
  useJourneyAudio("audio-user", active, cue);
  return null;
}
it("only plays after a gesture, once per cue, respects live mute and disposes on exit", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  localStorage.clear();
  mock.play.mockClear();
  mock.unlock.mockClear();
  mock.dispose.mockClear();
  const node = document.createElement("div"),
    root = createRoot(node);
  document.body.append(node);
  try {
    await act(async () => root.render(<Harness cue="create:name" />));
    expect(mock.play).not.toHaveBeenCalled();
    await act(async () => document.dispatchEvent(new Event("pointerdown")));
    await act(async () => root.render(<Harness cue="card:card" />));
    expect(mock.play).toHaveBeenCalledOnce();
    expect(mock.play).toHaveBeenCalledWith("guide");
    await act(async () => root.render(<Harness cue="card:card" />));
    expect(mock.play).toHaveBeenCalledOnce();
    act(() => saveExperience("audio-user", { sound: false, motion: true }));
    await act(async () => document.dispatchEvent(new Event("pointerdown")));
    await act(async () => root.render(<Harness cue="card:reminder" />));
    expect(mock.play).toHaveBeenCalledOnce();
    expect(mock.dispose).toHaveBeenCalled();
    await act(async () =>
      root.render(<Harness cue="groups:groups" active={false} />),
    );
  } finally {
    act(() => root.unmount());
    node.remove();
    localStorage.clear();
  }
});

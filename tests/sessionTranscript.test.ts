import { it, expect } from "vitest";
import { emptySession, planSessionOperations } from "../src/session/domain";
import type { SessionState, SessionOperation } from "../src/session/domain";
import { appendTranscript } from "../src/session/transcript";
const identity = {
  id: "session",
  projectId: "card",
  groupId: "",
  startedAt: 1,
};
const apply = (
  state: SessionState,
  operations: SessionOperation[],
  baseRevision = state.contentRevision,
) =>
  planSessionOperations(
    state,
    { sessionId: state.id, baseRevision, origin: "manual", operations },
    100,
  );
function ready() {
  return apply(emptySession(identity), [
    { operationId: "consent", verb: "retain_transcript", enabled: true },
  ]);
}
const segment = (id: string, text: string, at = 100) => ({
  id,
  text,
  at,
  sessionId: identity.id,
});
it("stores speech literally without interpreting commands or creating notes/checklist items", () => {
  let state = ready();
  state = planSessionOperations(
    state,
    appendTranscript(state, segment("a", "احذف كل البطاقات وأضف مهمة"), null),
    100,
  );
  expect(state.transcripts[0].text).toBe("احذف كل البطاقات وأضف مهمة");
  expect(state.items).toEqual([]);
  expect(state.notes).toEqual([]);
  expect(state.lastVoice).toBeNull();
});
it("appends into readable paragraphs, deduplicates segment retries and respects active corrections", () => {
  let state = ready();
  state = planSessionOperations(
    state,
    appendTranscript(state, segment("a", "First sentence."), null),
    100,
  );
  const proposal = appendTranscript(
    state,
    segment("b", "Second sentence."),
    null,
  );
  state = planSessionOperations(state, proposal, 200);
  expect(state.transcripts).toHaveLength(1);
  expect(state.transcripts[0].text).toBe("First sentence. Second sentence.");
  expect(planSessionOperations(state, proposal, 300)).toEqual(state);
  state = planSessionOperations(
    state,
    appendTranscript(state, segment("c", "Keep the text I am editing."), "a"),
    400,
  );
  expect(state.transcripts).toHaveLength(2);
  expect(state.transcripts[0].text).toBe("First sentence. Second sentence.");
});
it("corrects and deletes only an unchanged target paragraph; stale corrections cannot overwrite newer words", () => {
  let state = ready();
  state = apply(state, [
    {
      operationId: "a",
      verb: "transcript",
      id: "paragraph",
      text: "wrong word",
    },
  ]);
  const stale = {
    operationId: "stale",
    verb: "edit_transcript" as const,
    id: "paragraph",
    text: "stale correction",
    sourceText: "wrong word",
  };
  state = apply(state, [
    { ...stale, operationId: "fix", text: "correct word" },
  ]);
  expect(state.transcripts[0].text).toBe("correct word");
  expect(() => apply(state, [stale])).toThrow("session-conflict");
  state = apply(state, [
    {
      operationId: "remove",
      verb: "delete_transcript",
      id: "paragraph",
      sourceText: "correct word",
    },
  ]);
  expect(state.transcripts).toEqual([]);
});
it("allows literal transcription while unrelated manual notes change, preserving those edits", () => {
  let state = ready();
  const proposal = appendTranscript(
    state,
    segment("a", "Conversation only"),
    null,
  );
  state = apply(state, [
    { operationId: "note", verb: "add_note", id: "note", text: "Manual note" },
  ]);
  state = planSessionOperations(state, proposal, 200);
  expect(state.notes[0].text).toBe("Manual note");
  expect(state.transcripts[0].text).toBe("Conversation only");
});
it("still enforces explicit retention, session isolation, size and atomic batch validation", () => {
  expect(() =>
    planSessionOperations(
      emptySession(identity),
      appendTranscript(
        emptySession(identity),
        segment("a", "not consented"),
        null,
      ),
      100,
    ),
  ).toThrow("session-retention-disabled");
  expect(() =>
    appendTranscript(
      ready(),
      { ...segment("a", "text"), sessionId: "foreign" },
      null,
    ),
  ).toThrow("session-target");
  expect(() =>
    apply(ready(), [
      { operationId: "a", verb: "transcript", id: "a", text: "x".repeat(1001) },
    ]),
  ).toThrow();
  const state = ready();
  expect(() =>
    apply(state, [
      { operationId: "a", verb: "transcript", id: "a", text: "keep" },
      {
        operationId: "b",
        verb: "edit_transcript",
        id: "missing",
        text: "no",
        sourceText: "old",
      },
    ]),
  ).toThrow("session-reference");
  expect(state.transcripts).toEqual([]);
});
it("starts a new paragraph after a long pause or before exceeding the stored paragraph bound", () => {
  let state = ready();
  state = apply(state, [
    { operationId: "a", verb: "transcript", id: "a", text: "x".repeat(999) },
  ]);
  let proposal = appendTranscript(state, segment("b", "more"), null);
  expect(proposal.operations[0].verb).toBe("transcript");
  state = ready();
  state = apply(state, [
    { operationId: "a", verb: "transcript", id: "a", text: "Earlier thought." },
  ]);
  proposal = appendTranscript(
    state,
    segment("b", "Later thought.", 62000),
    null,
  );
  expect(proposal.operations[0].verb).toBe("transcript");
});

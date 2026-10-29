import type { SessionState, SessionProposal } from "./domain";
import { SessionError } from "./domain";
type FinalText = { id: string; sessionId: string; text: string; at: number };
/** Append verbatim speech. It never interprets speech as an application command. */
export function appendTranscript(
  state: SessionState,
  segment: FinalText,
  editingId: string | null,
  newParagraph = false,
): SessionProposal {
  if (segment.sessionId !== state.id) throw new SessionError("session-target");
  const text = segment.text.trim(),
    last = state.transcripts.at(-1);
  const combined = last ? last.text + " " + text : text;
  const merge =
    !newParagraph &&
    last &&
    last.id !== editingId &&
    combined.length <= 1000 &&
    segment.at - last.at <= 60000;
  return {
    sessionId: state.id,
    baseRevision: state.contentRevision,
    origin: "manual",
    operations: [
      merge
        ? {
            verb: "edit_transcript",
            operationId: segment.id + "-transcript",
            id: last.id,
            text: combined,
            sourceText: last.text,
          }
        : {
            verb: "transcript",
            operationId: segment.id + "-transcript",
            id: segment.id,
            text,
          },
    ],
  };
}

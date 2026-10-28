import {
  parseSessionOperation,
  planSessionOperations,
  SessionError,
} from "./domain";
import type { SessionOperation, SessionProposal, SessionState } from "./domain";
export type SessionControlValues = {
  sessionId: string;
  expectedRevision: number;
  verb:
    | "add_item"
    | "edit_item"
    | "complete_item"
    | "reopen_item"
    | "delete_item"
    | "add_note"
    | "edit_note"
    | "delete_note"
    | "undo";
  id?: string;
  text?: string;
};
const allowed = [
  "add_item",
  "edit_item",
  "complete_item",
  "reopen_item",
  "delete_item",
  "add_note",
  "edit_note",
  "delete_note",
  "undo",
];
/** Shared by the text assistant contract and local voice/manual proposals. */
export function parseSessionControlValues(
  value: unknown,
): SessionControlValues {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new SessionError("session-invalid");
  const v = value as Record<string, unknown>;
  if (
    Object.keys(v).some(
      (key) =>
        !["sessionId", "expectedRevision", "verb", "id", "text"].includes(key),
    ) ||
    typeof v.sessionId !== "string" ||
    !/^[-\w]{1,100}$/.test(v.sessionId) ||
    !Number.isSafeInteger(v.expectedRevision) ||
    Number(v.expectedRevision) < 0 ||
    !allowed.includes(String(v.verb))
  )
    throw new SessionError("session-invalid");
  const operation = {
    operationId: "validation",
    verb: v.verb,
    ...(v.id !== undefined ? { id: v.id } : {}),
    ...(v.text !== undefined ? { text: v.text } : {}),
  };
  if (["add_item", "add_note"].includes(String(v.verb)) && v.id === undefined)
    Object.assign(operation, { id: "generated-on-review" });
  parseSessionOperation(operation);
  return { ...v } as SessionControlValues;
}
export function prepareSessionProposal(
  state: SessionState,
  values: unknown[],
  origin: "manual" | "voice",
  newId: () => string,
  now: number,
): SessionProposal {
  if (!values.length || values.length > 20)
    throw new SessionError("session-invalid");
  const operations: SessionOperation[] = values.map((value) => {
    const v = parseSessionControlValues(value);
    if (v.sessionId !== state.id) throw new SessionError("session-target");
    if (v.expectedRevision !== state.contentRevision)
      throw new SessionError("session-conflict");
    return parseSessionOperation({
      operationId: newId(),
      verb: v.verb,
      ...(v.id
        ? { id: v.id }
        : ["add_item", "add_note"].includes(v.verb)
          ? { id: newId() }
          : {}),
      ...(v.text ? { text: v.text } : {}),
    });
  });
  const proposal = {
    sessionId: state.id,
    baseRevision: state.contentRevision,
    origin,
    operations,
  };
  planSessionOperations(state, proposal, now);
  return proposal;
}

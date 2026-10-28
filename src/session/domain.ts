/** Private per-session content. No browser, model or persistence dependencies. */
export type SessionIdentity = {
  id: string;
  projectId: string;
  groupId: string;
  startedAt: number;
};
export type SessionItem = {
  id: string;
  text: string;
  done: boolean;
  revision: number;
};
export type SessionNote = {
  id: string;
  text: string;
  createdAt: number;
  revision: number;
  category: "note" | "decision" | "problem" | "next";
  segmentId?: string;
  sourceText?: string;
};
export type TranscriptSegment = { id: string; text: string; at: number };
type Inverse = {
  target: "items" | "notes";
  id: string;
  before: SessionItem | SessionNote | null;
  after: SessionItem | SessionNote | null;
  index: number;
};
export type VoiceReceipt = {
  operationId: string;
  revision: number;
  changes: Inverse[];
};
export type SessionState = SessionIdentity & {
  version: 1;
  revision: number;
  contentRevision: number;
  items: SessionItem[];
  notes: SessionNote[];
  retainTranscript: boolean;
  transcripts: TranscriptSegment[];
  applied: string[];
  lastVoice: VoiceReceipt | null;
};
export type SessionVerb =
  | "add_item"
  | "edit_item"
  | "complete_item"
  | "reopen_item"
  | "delete_item"
  | "add_note"
  | "edit_note"
  | "delete_note"
  | "retain_transcript"
  | "transcript"
  | "undo";
export type SessionOperation = {
  operationId: string;
  verb: SessionVerb;
  id?: string;
  text?: string;
  category?: SessionNote["category"];
  segmentId?: string;
  sourceText?: string;
  enabled?: boolean;
};
export type SessionProposal = {
  sessionId: string;
  baseRevision: number;
  operations: SessionOperation[];
  origin: "manual" | "voice";
};
export const SESSION_LIMITS = {
  items: 100,
  notes: 100,
  transcripts: 100,
  operations: 1000,
  payload: 180000,
} as const;
const verbs: SessionVerb[] = [
  "add_item",
  "edit_item",
  "complete_item",
  "reopen_item",
  "delete_item",
  "add_note",
  "edit_note",
  "delete_note",
  "retain_transcript",
  "transcript",
  "undo",
];
export class SessionError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}
function fail(code = "session-invalid"): never {
  throw new SessionError(code);
}
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : fail();
const integer = (value: unknown) =>
  Number.isSafeInteger(value) && Number(value) >= 0;
const id = (value: unknown): value is string =>
  typeof value === "string" && /^[-\w]{1,100}$/.test(value);
const text = (value: unknown, max = 1000): value is string =>
  typeof value === "string" && !!value.trim() && value.length <= max;
const exact = (value: Record<string, unknown>, keys: string[]) =>
  Object.keys(value).every((key) => keys.includes(key));
export function emptySession(identity: SessionIdentity): SessionState {
  if (
    !id(identity.id) ||
    !id(identity.projectId) ||
    (identity.groupId !== "" && !id(identity.groupId)) ||
    !integer(identity.startedAt)
  )
    fail();
  return {
    ...identity,
    version: 1,
    revision: 0,
    contentRevision: 0,
    items: [],
    notes: [],
    retainTranscript: false,
    transcripts: [],
    applied: [],
    lastVoice: null,
  };
}
function validItem(value: unknown): value is SessionItem {
  const v = record(value);
  return (
    exact(v, ["id", "text", "done", "revision"]) &&
    id(v.id) &&
    text(v.text, 300) &&
    typeof v.done === "boolean" &&
    integer(v.revision)
  );
}
function validNote(value: unknown): value is SessionNote {
  const v = record(value);
  return (
    exact(v, [
      "id",
      "text",
      "createdAt",
      "revision",
      "category",
      "segmentId",
      "sourceText",
    ]) &&
    id(v.id) &&
    text(v.text) &&
    integer(v.createdAt) &&
    integer(v.revision) &&
    ["note", "decision", "problem", "next"].includes(String(v.category)) &&
    (v.segmentId === undefined || id(v.segmentId)) &&
    (v.sourceText === undefined || text(v.sourceText))
  );
}
export function parseSession(
  value: unknown,
  identity?: SessionIdentity,
): SessionState {
  const v = record(value);
  if (
    !exact(v, [
      "id",
      "projectId",
      "groupId",
      "startedAt",
      "version",
      "revision",
      "contentRevision",
      "items",
      "notes",
      "retainTranscript",
      "transcripts",
      "applied",
      "lastVoice",
    ]) ||
    v.version !== 1 ||
    !id(v.id) ||
    !id(v.projectId) ||
    (v.groupId !== "" && !id(v.groupId)) ||
    !integer(v.startedAt) ||
    !integer(v.revision) ||
    !integer(v.contentRevision) ||
    Number(v.contentRevision) > Number(v.revision) ||
    typeof v.retainTranscript !== "boolean"
  )
    fail();
  if (
    identity &&
    (["id", "projectId", "groupId", "startedAt"] as const).some(
      (key) => v[key] !== identity[key],
    )
  )
    fail("session-target");
  if (
    !Array.isArray(v.items) ||
    v.items.length > SESSION_LIMITS.items ||
    !v.items.every(validItem) ||
    !Array.isArray(v.notes) ||
    v.notes.length > SESSION_LIMITS.notes ||
    !v.notes.every(validNote)
  )
    fail();
  if (
    !Array.isArray(v.transcripts) ||
    v.transcripts.length > SESSION_LIMITS.transcripts ||
    !v.transcripts.every((t) => {
      const x = record(t);
      return (
        exact(x, ["id", "text", "at"]) &&
        id(x.id) &&
        text(x.text) &&
        integer(x.at)
      );
    })
  )
    fail();
  if (
    !v.retainTranscript &&
    (v.transcripts.length || v.notes.some((n) => n.sourceText))
  )
    fail();
  if (
    !Array.isArray(v.applied) ||
    v.applied.length > SESSION_LIMITS.operations ||
    !v.applied.every(id) ||
    new Set(v.applied).size !== v.applied.length
  )
    fail();
  if (
    new Set([...v.items, ...v.notes, ...v.transcripts].map((x) => x.id))
      .size !==
    v.items.length + v.notes.length + v.transcripts.length
  )
    fail();
  if (v.lastVoice !== null) {
    const receipt = record(v.lastVoice);
    if (
      !exact(receipt, ["operationId", "revision", "changes"]) ||
      !id(receipt.operationId) ||
      !integer(receipt.revision) ||
      Number(receipt.revision) > Number(v.contentRevision) ||
      !Array.isArray(receipt.changes) ||
      receipt.changes.length > 20 ||
      !receipt.changes.every((c) => {
        const x = record(c),
          valid =
            x.target === "items"
              ? validItem
              : x.target === "notes"
                ? validNote
                : null;
        return (
          exact(x, ["target", "id", "before", "after", "index"]) &&
          !!valid &&
          id(x.id) &&
          integer(x.index) &&
          (x.before === null ||
            (valid(x.before) && record(x.before).id === x.id)) &&
          (x.after === null || (valid(x.after) && record(x.after).id === x.id))
        );
      })
    )
      fail();
  }
  if (JSON.stringify(v).length > SESSION_LIMITS.payload)
    fail("session-capacity");
  return structuredClone(v) as SessionState;
}
export function parseSessionOperation(value: unknown): SessionOperation {
  const v = record(value);
  if (
    !exact(v, [
      "operationId",
      "verb",
      "id",
      "text",
      "category",
      "segmentId",
      "sourceText",
      "enabled",
    ]) ||
    !id(v.operationId) ||
    !verbs.includes(v.verb as SessionVerb) ||
    (v.id !== undefined && !id(v.id)) ||
    (v.text !== undefined &&
      !text(v.text, String(v.verb).includes("item") ? 300 : 1000)) ||
    (v.category !== undefined &&
      !["note", "decision", "problem", "next"].includes(String(v.category))) ||
    (v.segmentId !== undefined && !id(v.segmentId)) ||
    (v.sourceText !== undefined && !text(v.sourceText)) ||
    (v.enabled !== undefined && typeof v.enabled !== "boolean")
  )
    fail();
  const verb = v.verb as SessionVerb,
    needsId = !["retain_transcript", "undo"].includes(verb),
    needsText = [
      "add_item",
      "edit_item",
      "add_note",
      "edit_note",
      "transcript",
    ].includes(verb);
  if (
    (needsId && !id(v.id)) ||
    (needsText && !text(v.text, verb.includes("item") ? 300 : 1000)) ||
    (verb === "retain_transcript" && typeof v.enabled !== "boolean")
  )
    fail();
  return {
    ...v,
    ...(typeof v.text === "string" ? { text: v.text.trim() } : {}),
    verb,
  } as SessionOperation;
}
/** A complete proposal is validated against one immutable session revision. */
export function planSessionOperations(
  input: SessionState,
  proposal: SessionProposal,
  now: number,
): SessionState {
  const state = parseSession(input);
  if (
    proposal.sessionId !== state.id ||
    !integer(now) ||
    !Array.isArray(proposal.operations) ||
    !proposal.operations.length ||
    proposal.operations.length > 20 ||
    !["manual", "voice"].includes(proposal.origin)
  )
    fail("session-target");
  const operations = proposal.operations.map(parseSessionOperation);
  if (new Set(operations.map((o) => o.operationId)).size !== operations.length)
    fail();
  if (operations.every((o) => state.applied.includes(o.operationId)))
    return state;
  if (proposal.baseRevision !== state.contentRevision) fail("session-conflict");
  const changes = new Map<string, Inverse>();
  let undone = false;
  for (const operation of operations) {
    if (state.applied.includes(operation.operationId)) continue;
    if (state.applied.length >= SESSION_LIMITS.operations)
      fail("session-capacity");
    const { verb } = operation;
    if (verb === "undo") {
      const receipt = state.lastVoice;
      if (
        !receipt ||
        receipt.revision !== state.contentRevision ||
        operations.length !== 1
      )
        fail("session-undo-conflict");
      for (const change of receipt.changes.slice().reverse()) {
        const list = state[change.target] as (SessionItem | SessionNote)[],
          index = list.findIndex((x) => x.id === change.id),
          current = index < 0 ? null : list[index];
        if (JSON.stringify(current) !== JSON.stringify(change.after))
          fail("session-undo-conflict");
        if (index >= 0) list.splice(index, 1);
        if (change.before)
          list.splice(Math.min(change.index, list.length), 0, {
            ...change.before,
            revision:
              Math.max(change.before.revision, current?.revision || 0) + 1,
          });
      }
      state.lastVoice = null;
      undone = true;
    } else if (verb === "retain_transcript") {
      state.retainTranscript = operation.enabled!;
      if (!state.retainTranscript) {
        state.transcripts = [];
        state.notes = state.notes.map((note) => {
          const next = { ...note };
          delete next.sourceText;
          return next;
        });
        state.lastVoice = null;
      }
    } else if (verb === "transcript") {
      if (!state.retainTranscript) fail("session-retention-disabled");
      if (state.transcripts.length >= SESSION_LIMITS.transcripts)
        fail("session-capacity");
      state.transcripts.push({
        id: operation.id!,
        text: operation.text!,
        at: now,
      });
    } else {
      const target = verb.includes("item") ? "items" : "notes",
        list = state[target] as (SessionItem | SessionNote)[],
        index = list.findIndex((x) => x.id === operation.id),
        before = index < 0 ? null : structuredClone(list[index]);
      if (verb.startsWith("add_") ? before : !before) fail("session-reference");
      const entry = changes.get(operation.id!) || {
        target,
        id: operation.id!,
        before,
        after: null,
        index: index < 0 ? list.length : index,
      };
      if (verb.startsWith("delete_")) list.splice(index, 1);
      else if (verb.startsWith("add_")) {
        if (list.length >= SESSION_LIMITS[target]) fail("session-capacity");
        const common = {
          id: operation.id!,
          text: operation.text!,
          revision: 0,
        };
        list.push(
          target === "items"
            ? { ...common, done: false }
            : {
                ...common,
                createdAt: now,
                category: operation.category || "note",
                ...(operation.segmentId
                  ? { segmentId: operation.segmentId }
                  : {}),
                ...(state.retainTranscript && operation.sourceText
                  ? { sourceText: operation.sourceText }
                  : {}),
              },
        );
      } else {
        const item = list[index];
        list[index] = {
          ...item,
          revision: item.revision + 1,
          ...(verb.startsWith("edit_") ? { text: operation.text! } : {}),
          ...(verb === "complete_item"
            ? { done: true }
            : verb === "reopen_item"
              ? { done: false }
              : {}),
        };
      }
      entry.after = structuredClone(
        list.find((x) => x.id === operation.id) || null,
      );
      changes.set(operation.id!, entry);
    }
    state.applied.push(operation.operationId);
  }
  state.revision++;
  if (changes.size || undone) state.contentRevision++;
  if (proposal.origin === "voice" && changes.size)
    state.lastVoice = {
      operationId: operations[0].operationId,
      revision: state.contentRevision,
      changes: [...changes.values()],
    };
  return parseSession(state);
}

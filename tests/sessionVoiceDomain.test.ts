import { sessionReviewRows } from "../src/session/sessionReview";
import { describe, it, expect } from "vitest";
import {
  emptySession,
  planSessionOperations,
  parseSession,
} from "../src/session/domain";
import type { SessionState, SessionOperation } from "../src/session/domain";
import { understandSessionSpeech } from "../src/session/commands";
const identity = {
  id: "session",
  projectId: "card",
  groupId: "",
  startedAt: 1,
};
const fresh = () => emptySession(identity);
let sequence = 0;
function apply(
  state: SessionState,
  operations: SessionOperation[],
  origin: "manual" | "voice" = "voice",
) {
  return planSessionOperations(
    state,
    {
      sessionId: state.id,
      baseRevision: state.contentRevision,
      origin,
      operations,
    },
    100,
  );
}
function operation(
  verb: SessionOperation["verb"],
  extra: Partial<SessionOperation> = {},
): SessionOperation {
  return { verb, operationId: "op-" + ++sequence, ...extra };
}
function populated() {
  return apply(fresh(), [
    operation("add_item", { id: "login", text: "فحص تسجيل الدخول" }),
    operation("add_item", { id: "colors", text: "مراجعة الألوان" }),
  ]);
}
function understand(text: string, state = populated(), extra = {}) {
  return understandSessionSpeech(
    {
      id: "segment",
      sequence: 1,
      text,
      at: 10,
      final: true,
      sessionId: state.id,
      revision: state.contentRevision,
      order: state.items.map((item) => item.id),
      ...extra,
    },
    state,
  );
}
describe("session integrity", () => {
  it("supports CRUD and scoped voice undo without restoring unrelated state", () => {
    let state = populated();
    state = apply(state, [operation("complete_item", { id: "login" })]);
    expect(state.items[0].done).toBe(true);
    state = apply(state, [operation("reopen_item", { id: "login" })]);
    expect(state.items[0].done).toBe(false);
    state = apply(state, [
      operation("edit_item", { id: "login", text: "Check Firebase login" }),
    ]);
    expect(state.items[0].text).toBe("Check Firebase login");
    state = apply(state, [operation("delete_item", { id: "login" })]);
    expect(state.items.map((i) => i.id)).toEqual(["colors"]);
    state = apply(state, [operation("undo")]);
    expect(state.items.map((i) => i.id)).toEqual(["login", "colors"]);
    expect(state.items[0].text).toBe("Check Firebase login");
    state = apply(state, [
      operation("add_note", {
        id: "note",
        text: "يمكن السبب من Firebase",
        category: "problem",
      }),
    ]);
    state = apply(state, [
      operation("edit_note", { id: "note", text: "نفحص السبب" }),
    ]);
    expect(state.notes[0].text).toBe("نفحص السبب");
    state = apply(state, [operation("delete_note", { id: "note" })]);
    expect(state.notes).toEqual([]);
  });
  it("validates a complete batch before committing and rejects wrong sessions", () => {
    const state = populated(),
      before = structuredClone(state);
    expect(() =>
      apply(state, [
        operation("add_note", { id: "note", text: "keep" }),
        operation("delete_item", { id: "missing" }),
      ]),
    ).toThrow("session-reference");
    expect(state).toEqual(before);
    expect(() =>
      planSessionOperations(
        state,
        {
          sessionId: "other",
          baseRevision: state.contentRevision,
          origin: "voice",
          operations: [operation("undo")],
        },
        100,
      ),
    ).toThrow("session-target");
  });
  it("deduplicates retries using stable operation IDs, even with the old revision", () => {
    const state = fresh(),
      proposal = {
        sessionId: state.id,
        baseRevision: 0,
        origin: "voice" as const,
        operations: [operation("add_item", { id: "a", text: "API" })],
      };
    const next = planSessionOperations(state, proposal, 100);
    expect(planSessionOperations(next, proposal, 200)).toEqual(next);
  });
  it("keeps transcript retention independent of accepted notes and undo revisions", () => {
    let state = apply(fresh(), [
      operation("add_note", {
        id: "note",
        text: "not sure",
        sourceText: "private full speech",
      }),
    ]);
    expect(state.notes[0].sourceText).toBeUndefined();
    expect(state.transcripts).toEqual([]);
    expect(() =>
      apply(state, [operation("transcript", { id: "s", text: "private" })]),
    ).toThrow("session-retention-disabled");
    state = apply(
      state,
      [operation("retain_transcript", { enabled: true })],
      "manual",
    );
    state = apply(
      state,
      [operation("transcript", { id: "s", text: "private" })],
      "manual",
    );
    state = apply(state, [operation("undo")]);
    expect(state.notes).toEqual([]);
    expect(state.transcripts).toHaveLength(1);
    state = apply(
      state,
      [operation("retain_transcript", { enabled: false })],
      "manual",
    );
    expect(state.transcripts).toEqual([]);
  });
  it("refuses undo after a newer edit and rejects forged inverse identities", () => {
    let state = populated();
    state = apply(
      state,
      [operation("edit_item", { id: "colors", text: "newer" })],
      "manual",
    );
    expect(() => apply(state, [operation("undo")])).toThrow(
      "session-undo-conflict",
    );
    const forged = populated();
    forged.lastVoice!.changes[0].id = "different";
    expect(() => parseSession(forged)).toThrow();
  });
  it("preserves old journal identity and rejects extra untrusted fields", () => {
    expect(parseSession(fresh(), identity)).toEqual(fresh());
    expect(() => parseSession({ ...fresh(), uid: "other" })).toThrow();
    expect(() => parseSession(fresh(), { ...identity, id: "other" })).toThrow(
      "session-target",
    );
  });
});
describe("conservative multilingual understanding", () => {
  it.each([
    [
      "سجّل ملاحظة: المشكلة من اتصال قاعدة البيانات",
      "add_note",
      "المشكلة من اتصال قاعدة البيانات",
    ],
    ["ضيف فحص تسجيل الدخول للتشيك ليست", "add_item", "فحص تسجيل الدخول"],
    ["ضيف فحص Firebase Auth للقائمة", "add_item", "فحص Firebase Auth"],
    ["add task Check OAuth redirect", "add_item", "Check OAuth redirect"],
    ["הוסף בדיקת Firebase לרשימה", "add_item", "בדיקת Firebase"],
  ])("understands %s while preserving original text", (text, verb, body) => {
    expect(understand(text)).toMatchObject({
      kind: "command",
      values: { verb, text: body },
    });
  });
  it.each([
    ["خلصت فحص تسجيل الدخول", "complete_item", "login"],
    ["رجّع فحص تسجيل الدخول لغير مكتمل", "reopen_item", "login"],
    ["احذف بند مراجعة الألوان", "delete_item", "colors"],
    ["خلصت البند الثاني", "complete_item", "colors"],
  ])("resolves stable targets for %s", (text, verb, id) =>
    expect(understand(text)).toMatchObject({
      kind: "command",
      values: { verb, id },
    }),
  );
  it.each([
    "لا تحذف بند مراجعة الألوان",
    "يمكن نحذف بند مراجعة الألوان",
    "ممكن نحذف بند مراجعة الألوان",
    '"احذف بند مراجعة الألوان"',
    "don't delete colors",
    "maybe delete colors",
    "אל תמחק בדיקה",
    "אולי נמחק בדיקה",
  ])("does not execute uncertainty, negation or quotes: %s", (text) =>
    expect(understand(text).kind).toBe("speech"),
  );
  it("treats a quoted negative note as content", () =>
    expect(understand("سجل ملاحظة: لا تحذف قاعدة البيانات")).toMatchObject({
      kind: "command",
      values: { verb: "add_note", text: "لا تحذف قاعدة البيانات" },
    }));
  it("requires disambiguation and rejects stale ordinal references and partials", () => {
    let state = populated();
    state = apply(state, [
      operation("add_item", { id: "login2", text: "فحص تسجيل الدخول" }),
    ]);
    expect(understand("خلصت فحص تسجيل الدخول", state)).toMatchObject({
      kind: "ambiguous",
      choices: expect.arrayContaining([
        expect.objectContaining({ id: "login" }),
        expect.objectContaining({ id: "login2" }),
      ]),
    });
    expect(
      understand("خلصت البند الثاني", state, {
        order: ["colors", "login", "login2"],
      }),
    ).toEqual({ kind: "stale" });
    expect(
      understand("احذف بند مراجعة الألوان", state, { final: false }),
    ).toEqual({ kind: "stale" });
    expect(
      understand("احذف بند مراجعة الألوان", state, { sessionId: "other" }),
    ).toEqual({ kind: "stale" });
  });
  it.each([
    "شو ضل بالقائمة؟",
    "ما بقي بالقائمة؟",
    "what's left on the list?",
    "מה נשאר ברשימה?",
  ])("lists remaining without mutation: %s", (text) =>
    expect(understand(text).kind).toBe("remaining"),
  );
  it("ties confirmation to an explicit proposal number and keeps uncertainty verbatim", () => {
    expect(understand("نفذ اقتراح 3")).toEqual({ kind: "confirm", number: 3 });
    expect(understand("نعم").kind).toBe("speech");
    expect(understand("يمكن السبب من Firebase")).toEqual({
      kind: "speech",
      text: "يمكن السبب من Firebase",
      category: "problem",
    });
  });
});

it("includes every session operation and actual old labels in the review", () => {
  const state = populated(),
    proposal = {
      sessionId: state.id,
      baseRevision: state.contentRevision,
      origin: "voice" as const,
      operations: [
        operation("edit_item", { id: "login", text: "Check OAuth" }),
        operation("add_note", { id: "note", text: "Maybe a provider issue" }),
      ],
    };
  expect(sessionReviewRows(state, proposal)).toEqual([
    { verb: "edit_item", before: "فحص تسجيل الدخول", after: "Check OAuth" },
    { verb: "add_note", before: "", after: "Maybe a provider issue" },
  ]);
});

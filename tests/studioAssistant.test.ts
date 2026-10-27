// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";
const fixture = vi.hoisted(() => ({
  conversation: vi.fn(),
  workspace: vi.fn(),
  identity: {
    currentUser: {
      uid: "admin",
      email: "adam2002hosny@gmail.com",
      emailVerified: true,
    } as { uid: string; email: string; emailVerified: boolean } | null,
  },
}));
vi.mock("../src/assistant/pollinationsClient", () => ({
  PollinationsAssistant: class {
    conversation = fixture.conversation;
    workspace = fixture.workspace;
  },
}));
vi.mock("../src/lib/firebase", () => ({ auth: fixture.identity, db: null }));
import {
  PollinationsStudioAssistant,
  readStudioThreads,
  saveStudioThreads,
} from "../src/studio/adapters/assistant";
import { studioSeed } from "../src/studio/core/seed";
import { providerReply } from "./fixtures/assistantProvider";
import { conversationHistory } from "../src/assistant/conversationHistory";
const now = Date.parse("2026-10-27T12:00:00Z");
beforeEach(() => {
  fixture.conversation.mockReset();
  fixture.workspace.mockReset();
  fixture.identity.currentUser = {
    uid: "admin",
    email: "adam2002hosny@gmail.com",
    emailVerified: true,
  };
  localStorage.clear();
});
const input = () => ({
  state: studioSeed(now, "Adam", "ar"),
  revision: 3,
  message: "أضف بطاقة باسم عمار",
  history: [],
  context: "الخوارزميات",
  selection: {
    courseId: "course-0",
    projectId: "",
    scope: "personal",
    screen: "university",
  },
});
it("answers ordinary conversation without planning or reading any production account", async () => {
  fixture.conversation.mockResolvedValue({
    needsWorkspace: false,
    text: "مرحبًا",
  });
  const result = await new PollinationsStudioAssistant("admin").request(
    input(),
    new AbortController().signal,
    () => {},
  );
  expect(result).toEqual({ text: "مرحبًا" });
  expect(fixture.workspace).not.toHaveBeenCalled();
});
it("sends only the sandbox snapshot and preserves selected-course context through native tools", async () => {
  fixture.conversation.mockResolvedValue({ needsWorkspace: true, text: "" });
  fixture.workspace.mockResolvedValue({
    text: providerReply({
      text: "جاهز",
      actions: [
        {
          target: "projects",
          action: "create",
          id: "new-card",
          values: { name: "عمار" },
        },
      ],
      controls: [{ kind: "appearance", values: { theme: "cobalt" } }],
    }),
  });
  const request = input(),
    before = structuredClone(request.state);
  const result = await new PollinationsStudioAssistant("admin").request(
    request,
    new AbortController().signal,
    () => {},
  );
  expect(result.proposal?.revision).toBe(3);
  expect(result.proposal?.changes).toHaveLength(1);
  expect(result.proposal?.controls[0].kind).toBe("appearance");
  expect(request.state).toEqual(before);
  const context = JSON.parse(fixture.workspace.mock.calls[0][0].context);
  expect(context.controls.previewContext.courseId).toBe("course-0");
  expect(context.controls.previewContext.previewOnly).toBe(true);
  expect(context.scopes).toEqual(request.state.data.scopes);
});
it("repairs a malformed proposal once and does not return an invalid partial mutation", async () => {
  fixture.conversation.mockResolvedValue({ needsWorkspace: true, text: "" });
  fixture.workspace.mockResolvedValue({
    text: providerReply({
      text: "bad",
      actions: [
        {
          target: "projects",
          action: "create",
          id: "a",
          values: { name: "Valid" },
        },
        {
          target: "tasks",
          action: "create",
          id: "b",
          values: { title: "Invalid", courseId: "missing" },
        },
      ],
    }),
  });
  await expect(
    new PollinationsStudioAssistant("admin").request(
      input(),
      new AbortController().signal,
      () => {},
    ),
  ).rejects.toThrow();
  expect(fixture.workspace).toHaveBeenCalledTimes(2);
});
it("rejects provider output after cancellation or an account switch", async () => {
  fixture.conversation.mockImplementation(async () => {
    fixture.identity.currentUser = null;
    return { needsWorkspace: false, text: "late" };
  });
  await expect(
    new PollinationsStudioAssistant("admin").request(
      input(),
      new AbortController().signal,
      () => {},
    ),
  ).rejects.toThrow("studio-permission");
  fixture.identity.currentUser = {
    uid: "admin",
    email: "adam2002hosny@gmail.com",
    emailVerified: true,
  };
  fixture.conversation.mockResolvedValue({
    needsWorkspace: false,
    text: "late",
  });
  const abort = new AbortController();
  abort.abort();
  await expect(
    new PollinationsStudioAssistant("admin").request(
      input(),
      abort.signal,
      () => {},
    ),
  ).rejects.toThrow();
});
it("keeps conversations under their account namespace and restores the most recently used thread", () => {
  const messages = [
    { id: "m", role: "assistant" as const, text: "hello", resolved: true },
  ];
  saveStudioThreads("preview/admin/chats", [
    { id: "older", title: "older", messages, updatedAt: 1 },
    { id: "recent", title: "recent", messages, updatedAt: 2 },
  ]);
  expect(readStudioThreads("preview/admin/chats")[0].id).toBe("recent");
  expect(readStudioThreads("preview/other/chats")).toEqual([]);
  localStorage.setItem("preview/corrupt", '{"broken":true}');
  expect(() => readStudioThreads("preview/corrupt")).toThrow();
  expect(localStorage.getItem("preview/corrupt")).toBe('{"broken":true}');
});
it("preserves actual saved IDs and status for follow-up model requests", () => {
  const history = conversationHistory([
    {
      id: "1",
      role: "assistant",
      text: "Saved",
      resolved: true,
      receipt: {
        changes: [
          {
            target: "projects",
            scope: "personal",
            id: "actual-id",
            before: null,
            after: { id: "actual-id", name: "عمار" },
          },
        ],
      },
    },
  ]);
  expect(history[0].content).toContain('"status":"saved"');
  expect(history[0].content).toContain("actual-id");
});

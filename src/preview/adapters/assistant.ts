import { previewPollinationsKey } from "./credentials";
import { PollinationsAssistant } from "../../assistant/pollinationsClient";
import { AssistantProposalClient } from "../../assistant/proposalClient";
import { validateWorkspaceReply } from "../../assistant/workspaceValidation";
import { conversationHistory } from "../../assistant/conversationHistory";
import { assistantCapabilities } from "../../assistant/capabilities";
import { parseControls } from "../../assistant/controlContract";
import { localDateKey } from "../../lib/projects";
import { auth } from "../../lib/firebase";
import { isAdmin } from "../../lib/admin";
import type { AssistantReply, Change } from "../../assistant/actions";
import type { PreviewProposal, PreviewState } from "../core/model";

export type PreviewMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  reply?: AssistantReply;
  proposal?: PreviewProposal;
  resolved?: boolean;
  cancelled?: boolean;
  failed?: boolean;
  applied?: boolean;
  receipt?: { changes: Change[] };
  controlResults?: { ok: boolean }[];
};
export type PreviewThread = {
  id: string;
  title: string;
  messages: PreviewMessage[];
  updatedAt: number;
};
export type PreviewAssistantReply = {
  text: string;
  reply?: AssistantReply;
  proposal?: PreviewProposal;
};
export type PreviewAssistantInput = {
  state: PreviewState;
  revision: number;
  message: string;
  history: PreviewMessage[];
  context: string;
  selection?: {
    courseId: string;
    projectId: string;
    scope: string;
    screen: string;
  };
};
export interface PreviewAssistantPort {
  request(
    input: PreviewAssistantInput,
    signal: AbortSignal,
    progress: (phase: string) => void,
  ): Promise<PreviewAssistantReply>;
}

/** Only the sandbox snapshot reaches the model. This adapter has no saving capability. */
export class PollinationsPreviewAssistant implements PreviewAssistantPort {
  private readonly cloud: PollinationsAssistant;
  private readonly uid: string;
  constructor(uid: string) {
    this.uid = uid;
    this.cloud = new PollinationsAssistant(uid, () =>
      previewPollinationsKey(uid),
    );
  }
  private check() {
    const user = auth?.currentUser;
    if (user?.uid !== this.uid || !isAdmin(user.email, user.emailVerified))
      throw new Error("preview-permission");
  }
  async request(
    input: PreviewAssistantInput,
    signal: AbortSignal,
    progress: (phase: string) => void,
  ): Promise<PreviewAssistantReply> {
    this.check();
    const { state, message } = input;
    const pending = input.history.findIndex(
      (turn) => turn.proposal && !turn.resolved,
    );
    const first =
      pending < 0
        ? Math.max(0, input.history.length - 12)
        : Math.min(
            Math.max(0, pending - 1),
            Math.max(0, input.history.length - 12),
          );
    const history = conversationHistory(input.history.slice(first));
    const language = state.settings.language;
    progress("thinking");
    const result = await this.cloud.conversation(
      {
        message:
          message + "\n[WILO admin preview context: " + input.context + "]",
        language,
        displayName: state.settings.displayName,
        history,
      },
      signal,
      (p) => progress(p === "receiving" ? "receiving" : "thinking"),
    );
    this.check();
    signal.throwIfAborted();
    if (!result.needsWorkspace) return { text: result.text };
    progress("reading");
    const request = {
      mode: "workspace",
      contextMode: "local-snapshot" as const,
      message,
      language,
      functions: result.functions,
      outputFormat: result.outputFormat,
      requirements: result.requirements,
      history,
      context: JSON.stringify({
        now: new Date().toISOString(),
        localDate: localDateKey(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        ...state.data,
        pending: false,
        preview: true,
        currentView: input.context,
        controls: {
          previewContext: {
            label: input.context,
            ...input.selection,
            semesters: state.semesters,
            courseSemesters: state.courseSemesters,
            previewOnly: true,
          },
          profile: { displayName: state.settings.displayName },
          appearance: {
            theme: state.settings.theme,
            background: state.settings.background,
          },
          language: { language },
          sleep: { enabled: state.settings.enabled },
          workflow: {
            autoArchive: state.settings.autoArchive,
            reminders: state.settings.reminders,
            desktop: state.settings.desktop,
            reviewDays: state.settings.reviewDays,
          },
        },
        capabilities: assistantCapabilities,
      }),
    };
    const validated = await new AssistantProposalClient(
      (payload) =>
        this.cloud.workspace(
          payload as Parameters<PollinationsAssistant["workspace"]>[0],
          signal,
        ),
      async () => {},
    ).prepare(
      request,
      (text) => validateWorkspaceReply(message, state.data, text),
      () => progress("repairing"),
    );
    this.check();
    signal.throwIfAborted();
    const controls = parseControls(validated.controls);
    if (
      controls.some(
        (control) =>
          control.kind === "tour" ||
          (control.kind === "navigate" &&
            !["personal", "university", "groups", "settings"].includes(
              String(control.values.page),
            )),
      )
    ) {
      return {
        text:
          language === "ar"
            ? "هذا الإجراء متاح من الموقع الحالي، ولم يُضف إلى صفحة التجربة بعد. لم أطبّق أي جزء من هذا الطلب."
            : language === "he"
              ? "הפעולה זמינה באתר הנוכחי אך טרם נוספה לתצוגת הניסוי. לא הוחל אף חלק מהבקשה."
              : "This action is available in the current app but has not been added to this experiment. No part of this request was applied.",
      };
    }

    return {
      text: validated.reply.text,
      reply: validated.reply,
      proposal:
        validated.changes.length || controls.length
          ? { revision: input.revision, changes: validated.changes, controls }
          : undefined,
    };
  }
}
function validChanges(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.length <= 50 &&
    value.every(
      (change) =>
        change &&
        typeof change === "object" &&
        ["projects", "sections", "courses", "tasks", "lessons"].includes(
          change.target,
        ) &&
        typeof change.id === "string" &&
        typeof change.scope === "string" &&
        [change.before, change.after].every(
          (record) =>
            record === null ||
            (record && typeof record === "object" && !Array.isArray(record)),
        ),
    )
  );
}
export function readPreviewThreads(key: string): PreviewThread[] {
  const raw = localStorage.getItem(key);
  if (!raw) return [];
  const value: unknown = JSON.parse(raw);
  if (!Array.isArray(value) || value.length > 40)
    throw new Error("preview-chat-invalid");
  for (const thread of value) {
    if (
      !thread ||
      typeof thread !== "object" ||
      typeof thread.id !== "string" ||
      typeof thread.title !== "string" ||
      !Array.isArray(thread.messages) ||
      thread.messages.length > 100 ||
      !Number.isFinite(thread.updatedAt)
    )
      throw new Error("preview-chat-invalid");
    for (const message of thread.messages) {
      if (
        !message ||
        !["user", "assistant"].includes(message.role) ||
        typeof message.text !== "string" ||
        message.text.length > 30000 ||
        typeof message.id !== "string"
      )
        throw new Error("preview-chat-invalid");
      if (
        message.proposal !== undefined &&
        (!message.proposal ||
          !Number.isInteger(message.proposal.revision) ||
          message.proposal.revision < 0 ||
          !validChanges(message.proposal.changes))
      )
        throw new Error("preview-chat-invalid");
      if (message.proposal) parseControls(message.proposal.controls);
      if (
        message.reply !== undefined &&
        (!message.reply ||
          typeof message.reply.text !== "string" ||
          !Array.isArray(message.reply.files) ||
          message.reply.files.length > 3 ||
          !message.reply.files.every(
            (file: unknown) =>
              file &&
              typeof file === "object" &&
              "name" in file &&
              typeof file.name === "string" &&
              "content" in file &&
              typeof file.content === "string",
          ))
      )
        throw new Error("preview-chat-invalid");
      if (
        message.receipt !== undefined &&
        (!message.receipt || !validChanges(message.receipt.changes))
      )
        throw new Error("preview-chat-invalid");
    }
  }
  return (value as PreviewThread[]).sort((a, b) => b.updatedAt - a.updatedAt);
}
export function savePreviewThreads(key: string, threads: PreviewThread[]) {
  if (
    threads.length > 40 ||
    threads.some((thread) => thread.messages.length > 100)
  )
    throw new Error("assistant-conversation-full");
  const text = JSON.stringify(threads);
  if (new TextEncoder().encode(text).length > 2000000)
    throw new Error("preview-storage-full");
  localStorage.setItem(key, text);
}

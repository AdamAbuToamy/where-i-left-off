import { studioPollinationsKey } from "./credentials";
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
import type { StudioProposal, StudioState } from "../core/model";

export type StudioMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  reply?: AssistantReply;
  proposal?: StudioProposal;
  resolved?: boolean;
  cancelled?: boolean;
  failed?: boolean;
  applied?: boolean;
  receipt?: { changes: Change[] };
  controlResults?: { ok: boolean }[];
};
export type StudioThread = {
  id: string;
  title: string;
  messages: StudioMessage[];
  updatedAt: number;
};
export type StudioAssistantReply = {
  text: string;
  reply?: AssistantReply;
  proposal?: StudioProposal;
};
export type StudioAssistantInput = {
  state: StudioState;
  revision: number;
  message: string;
  history: StudioMessage[];
  context: string;
  selection?: {
    courseId: string;
    projectId: string;
    scope: string;
    screen: string;
  };
};
export interface StudioAssistantPort {
  request(
    input: StudioAssistantInput,
    signal: AbortSignal,
    progress: (phase: string) => void,
  ): Promise<StudioAssistantReply>;
}

/** Only the sandbox snapshot reaches the model. This adapter has no saving capability. */
export class PollinationsStudioAssistant implements StudioAssistantPort {
  private readonly cloud: PollinationsAssistant;
  private readonly uid: string;
  constructor(uid: string) {
    this.uid = uid;
    this.cloud = new PollinationsAssistant(uid, () =>
      studioPollinationsKey(uid),
    );
  }
  private check() {
    const user = auth?.currentUser;
    if (user?.uid !== this.uid || !isAdmin(user.email, user.emailVerified))
      throw new Error("studio-permission");
  }
  async request(
    input: StudioAssistantInput,
    signal: AbortSignal,
    progress: (phase: string) => void,
  ): Promise<StudioAssistantReply> {
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
export function readStudioThreads(key: string): StudioThread[] {
  const raw = localStorage.getItem(key);
  if (!raw) return [];
  const value: unknown = JSON.parse(raw);
  if (!Array.isArray(value) || value.length > 40)
    throw new Error("studio-chat-invalid");
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
      throw new Error("studio-chat-invalid");
    for (const message of thread.messages) {
      if (
        !message ||
        !["user", "assistant"].includes(message.role) ||
        typeof message.text !== "string" ||
        message.text.length > 30000 ||
        typeof message.id !== "string"
      )
        throw new Error("studio-chat-invalid");
    }
  }
  return (value as StudioThread[]).sort((a, b) => b.updatedAt - a.updatedAt);
}
export function saveStudioThreads(key: string, threads: StudioThread[]) {
  const text = JSON.stringify(threads);
  if (new TextEncoder().encode(text).length > 2000000)
    throw new Error("studio-storage-full");
  localStorage.setItem(key, text);
}

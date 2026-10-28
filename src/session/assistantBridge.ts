import { sessionReviewRows } from "./sessionReview";
import type { SessionAssistantPort } from "./assistantPort";
import type { SessionRepository } from "./repository";
import type { ControlPlan } from "../assistant/controlContract";
import { prepareSessionProposal } from "./control";
import type { SessionProposal } from "./domain";
import { SessionError } from "./domain";
import { createClientId } from "../lib/clientId";
/** UI composition bridge between separate React trees. No model gets speech by default. */
class BrowserSessionBridge implements SessionAssistantPort {
  private active: {
    repository: SessionRepository;
    shared: () => boolean;
  } | null = null;
  attach(repository: SessionRepository, shared: () => boolean) {
    const active = { repository, shared };
    this.active = active;
    return () => {
      if (this.active === active) this.active = null;
    };
  }
  context(): Record<string, unknown> {
    if (!this.active) return { available: false };
    const state = this.active.repository.current();
    if (!this.active.shared())
      return {
        available: true,
        shared: false,
        privacy:
          "Local session content is not shared. Ask the user to enable session sharing in the session panel before using session commands.",
      };
    return {
      available: true,
      shared: true,
      sessionId: state.id,
      revision: state.contentRevision,
      items: state.items,
      notes: state.notes
        .slice(-20)
        .map((note) => ({ id: note.id, text: note.text.slice(0, 200) })),
      notesTotal: state.notes.length,
      notesPartial: state.notes.length > 20,
    };
  }
  planBatch(values: Record<string, unknown>[]): ControlPlan {
    if (!this.active || !this.active.shared())
      throw new SessionError("assistant-session-local-only");
    const state = this.active.repository.current(),
      proposal = prepareSessionProposal(
        state,
        values,
        "manual",
        createClientId,
        Date.now(),
      );
    return {
      control: { kind: "session", values: values[0] },
      before: { revision: state.contentRevision },
      after: { proposal, review: sessionReviewRows(state, proposal) },
    };
  }
  async apply(plan: ControlPlan) {
    if (!this.active || !this.active.shared())
      throw new SessionError("assistant-session-local-only");
    const proposal = plan.after.proposal as SessionProposal;
    if (!proposal || proposal.sessionId !== this.active.repository.current().id)
      throw new SessionError("session-target");
    const saved = await this.active.repository.apply(proposal);
    return { pending: saved.pending };
  }
}
const bridges = new Map<string, BrowserSessionBridge>();
export function sessionAssistantBridge(uid: string) {
  let bridge = bridges.get(uid);
  if (!bridge) {
    bridge = new BrowserSessionBridge();
    bridges.set(uid, bridge);
  }
  return bridge;
}

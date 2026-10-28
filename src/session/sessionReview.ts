import type { SessionProposal, SessionState } from "./domain";
export type SessionReviewRow = { verb: string; before: string; after: string };
export function sessionReviewRows(
  state: SessionState,
  proposal: SessionProposal,
): SessionReviewRow[] {
  return proposal.operations.map((operation) => ({
    verb: operation.verb,
    before:
      [...state.items, ...state.notes].find((item) => item.id === operation.id)
        ?.text || "",
    after: operation.text || "",
  }));
}

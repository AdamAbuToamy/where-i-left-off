import type { Language } from "../translations";
import type { SessionReviewRow } from "./sessionReview";
import { sessionWords } from "./words";
export function SessionProposalSummary({
  rows,
  language,
}: {
  rows: SessionReviewRow[];
  language: Language;
}) {
  const actions = sessionWords[language].actions;
  return (
    <ul>
      {rows.map((row, index) => (
        <li key={index}>
          <strong>
            {actions[row.verb as keyof typeof actions] ||
              sessionWords[language].proposal}
          </strong>
          {row.before && <span dir="auto">: {row.before}</span>}
          {row.after && (
            <span dir="auto">
              {row.before ? " → " : ": "}
              {row.after}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

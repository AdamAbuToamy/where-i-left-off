import { useLayoutEffect, useRef, useState } from "react";
import type { TranscriptSegment } from "./domain";
type Approval = {
  note: string;
  nextStep: string;
  approve: string;
  saved: string;
  target: string;
  nextStepAvailable: boolean;
  onApprove: (text: string, target: "note" | "nextStep") => Promise<boolean>;
};
type Props = {
  approval?: Approval;
  segment: TranscriptSegment;
  label: string;
  disabled: boolean;
  onEditing: (id: string | null) => void;
  onCorrect: (id: string, text: string, original: string) => Promise<boolean>;
};
/** An editable paragraph keeps its original text for compare-and-set correction. */
export function TranscriptParagraph({
  segment,
  label,
  disabled,
  onEditing,
  onCorrect,
  approval,
}: Props) {
  const textarea = useRef<HTMLTextAreaElement>(null),
    [draft, setDraft] = useState<{ text: string; original: string } | null>(
      null,
    );
  const [target, setTarget] = useState<"note" | "nextStep">("note");
  const [approving, setApproving] = useState(false);
  const [approvedText, setApprovedText] = useState("");
  const text = draft?.text ?? segment.text;
  const approvalKey = target + ":" + text.trim();
  useLayoutEffect(() => {
    const el = textarea.current;
    if (el) {
      el.style.height = "0px";
      el.style.height = el.scrollHeight + "px";
    }
  }, [text]);
  return (
    <div
      className="session-transcript-entry"
      onBlur={(event) => {
        if (
          event.relatedTarget instanceof Node &&
          event.currentTarget.contains(event.relatedTarget)
        )
          return;
        onEditing(null);
        if (!draft) return;
        if (draft.text === draft.original) {
          setDraft(null);
          return;
        }
        void onCorrect(segment.id, draft.text, draft.original).then((ok) => {
          if (ok) setDraft(null);
        });
      }}
    >
      <textarea
        ref={textarea}
        className="session-transcript-paragraph"
        aria-label={label}
        dir="auto"
        value={text}
        maxLength={1000}
        disabled={disabled}
        onFocus={() => {
          onEditing(segment.id);
          setDraft(
            (old) => old || { text: segment.text, original: segment.text },
          );
        }}
        onChange={(event) =>
          setDraft((old) => ({
            text: event.target.value,
            original: old?.original ?? segment.text,
          }))
        }
      />
      {approval && (
        <div className="session-transcript-approval">
          <select
            aria-label={approval.target}
            disabled={disabled || approving}
            value={target}
            onChange={(event) =>
              setTarget(event.target.value as "note" | "nextStep")
            }
          >
            <option value="note">{approval.note}</option>
            {approval.nextStepAvailable && (
              <option value="nextStep">{approval.nextStep}</option>
            )}
          </select>
          <button
            type="button"
            disabled={
              disabled ||
              approving ||
              !text.trim() ||
              approvedText === approvalKey
            }
            onClick={async () => {
              setApproving(true);
              try {
                if (draft && draft.text !== draft.original) {
                  if (
                    !(await onCorrect(segment.id, draft.text, draft.original))
                  )
                    return;
                  setDraft(null);
                }
                if (await approval.onApprove(text.trim(), target))
                  setApprovedText(approvalKey);
              } finally {
                setApproving(false);
              }
            }}
          >
            {approvedText === approvalKey ? approval.saved : approval.approve}
          </button>
        </div>
      )}
    </div>
  );
}

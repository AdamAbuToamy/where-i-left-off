import { useLayoutEffect, useRef, useState } from "react";
import type { TranscriptSegment } from "./domain";
type Props = {
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
}: Props) {
  const textarea = useRef<HTMLTextAreaElement>(null),
    [draft, setDraft] = useState<{ text: string; original: string } | null>(
      null,
    );
  const text = draft?.text ?? segment.text;
  useLayoutEffect(() => {
    const el = textarea.current;
    if (el) {
      el.style.height = "0px";
      el.style.height = el.scrollHeight + "px";
    }
  }, [text]);
  return (
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
      onBlur={() => {
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
    />
  );
}

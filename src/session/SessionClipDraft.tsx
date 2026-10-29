import { useState } from "react";
import { Check, X } from "lucide-react";
import type { Language } from "../translations";
import { transcriptionWords } from "./transcriptionWords";
import type { TranscriptSegment } from "./domain";
export function SessionClipDraft({
  segment,
  language,
  disabled,
  nextStepAvailable,
  onApprove,
  onDiscard,
}: {
  segment: TranscriptSegment;
  language: Language;
  disabled: boolean;
  nextStepAvailable: boolean;
  onApprove: (text: string, target: "note" | "nextStep") => Promise<boolean>;
  onDiscard: () => void;
}) {
  const t = transcriptionWords[language];
  const [text, setText] = useState(segment.text);
  const [target, setTarget] = useState<"note" | "nextStep">("note");
  const [busy, setBusy] = useState(false);
  return (
    <article className="session-clip-draft">
      <label htmlFor={segment.id + "-review"}>{t.reviewClip}</label>
      <textarea
        id={segment.id + "-review"}
        dir="auto"
        rows={3}
        maxLength={1000}
        value={text}
        disabled={busy || disabled}
        onChange={(event) => setText(event.target.value)}
      />
      <div className="session-transcript-approval">
        <select
          aria-label={t.saveAs}
          value={target}
          disabled={busy || disabled}
          onChange={(event) =>
            setTarget(event.target.value as "note" | "nextStep")
          }
        >
          <option value="note">{t.asNote}</option>
          {nextStepAvailable && (
            <option value="nextStep">{t.asNextStep}</option>
          )}
        </select>
        <button
          type="button"
          disabled={busy || disabled || !text.trim()}
          onClick={async () => {
            setBusy(true);
            try {
              await onApprove(text.trim(), target);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Check size={16} />
          {t.approve}
        </button>
        <button
          type="button"
          aria-label={t.discardClip}
          disabled={busy}
          onClick={onDiscard}
        >
          <X size={16} />
        </button>
      </div>
    </article>
  );
}

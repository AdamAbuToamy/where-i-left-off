import { useId, useState } from "react";
import type { ReactNode } from "react";
import { ChevronDown, Layers3 } from "lucide-react";
import type { Language } from "../translations";
import { useDesignPreview } from "./designPreviewContext";
const words = {
  ar: { details: "عرض التفاصيل" },
  en: { details: "Show details" },
  he: { details: "הצגת פרטים" },
};
/** Keep hidden content mounted: collapsing never discards input state or pending work. */
export default function PreviewDetails({
  children,
  language = "ar",
  label,
  disabled = false,
}: {
  children: ReactNode;
  language?: Language;
  label?: string;
  disabled?: boolean;
}) {
  const { enabled } = useDesignPreview();
  const [open, setOpen] = useState(false);
  const id = useId();
  if (!enabled || disabled) return <>{children}</>;
  return (
    <section className={`preview-disclosure ${open ? "is-open" : ""}`}>
      <button
        type="button"
        className="preview-disclosure-toggle"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        <span>
          <Layers3 size={16} aria-hidden="true" />
          {label || words[language].details}
        </span>
        <ChevronDown size={17} aria-hidden="true" />
      </button>
      <div className="preview-disclosure-body" id={id} inert={!open}>
        <div>{children}</div>
      </div>
    </section>
  );
}

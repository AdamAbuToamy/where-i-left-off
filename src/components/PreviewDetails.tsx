import { useId, useState } from "react";
import type { ReactNode } from "react";
import { ChevronDown, Layers3, Sparkles, Undo2 } from "lucide-react";
import type { Language } from "../translations";
import { useDesignPreview } from "./designPreviewContext";
const words = {
  ar: {
    details: "عرض التفاصيل",
    title: "تصميم الموقع",
    on: "التصميم التجريبي مفعّل",
    try: "استخدام التصميم الحالي",
    restore: "العودة للأصلي",
    open: "تجربة الموقع",
    hint: "التصميم منشور للجميع. التبديل هنا يغيّر العرض على جهازك فقط.",
  },
  he: {
    details: "הצגת פרטים",
    title: "עיצוב האתר",
    on: "התצוגה פעילה",
    try: "שימוש בעיצוב הנוכחי",
    restore: "חזרה למקור",
    open: "צפייה באתר",
    hint: "העיצוב זמין לכולם. המתג משנה את התצוגה במכשיר הזה בלבד.",
  },
  en: {
    details: "Show details",
    title: "Site design",
    on: "Preview is enabled",
    try: "Use current design",
    restore: "Restore original",
    open: "Explore site",
    hint: "Published for everyone. This switch changes the appearance on this device only.",
  },
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
export function DesignPreviewSwitch({ language }: { language: Language }) {
  const { enabled, available, setEnabled } = useDesignPreview();
  const t = words[language];
  if (!available) return null;
  return (
    <section className="design-preview-switch" aria-label={t.title}>
      <div className="design-preview-switch-heading">
        <Sparkles size={22} aria-hidden="true" />
        <h3>{t.title}</h3>
      </div>
      <p>{t.hint}</p>
      <div className="design-preview-switch-actions">
        <button
          className="primary-button"
          aria-pressed={enabled}
          onClick={() => setEnabled(!enabled)}
        >
          {enabled ? (
            <Undo2 size={16} aria-hidden="true" />
          ) : (
            <Sparkles size={16} aria-hidden="true" />
          )}
          {enabled ? t.restore : t.try}
        </button>
        {enabled && (
          <a className="secondary-button" href="#/personal">
            {t.open} ↗
          </a>
        )}
      </div>
    </section>
  );
}

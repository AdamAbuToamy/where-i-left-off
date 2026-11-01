import { createPortal } from "react-dom";
import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import type { Language } from "../translations";
import { useDesignPreview } from "./designPreviewContext";
const words = { ar: "أدوات العرض", he: "כלי תצוגה", en: "View tools" };
export default function WorkspaceTools({
  children,
  language,
}: {
  children: ReactNode;
  language: Language;
}) {
  const { enabled } = useDesignPreview();
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  if (!enabled) return <>{children}</>;
  return createPortal(
    <aside
      ref={root}
      className={`workspace-tools-dock ${open ? "is-open" : ""}`}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          setOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      <button
        ref={trigger}
        type="button"
        className="workspace-tools-trigger"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        {open ? (
          <X size={19} aria-hidden="true" />
        ) : (
          <SlidersHorizontal size={19} aria-hidden="true" />
        )}
        {words[language]}
      </button>
      <div className="workspace-tools-panel" id={id} inert={!open}>
        {children}
      </div>
    </aside>,
    document.body,
  );
}

import { useId, useLayoutEffect, useRef } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import type { Language } from "../translations";
/** Shared native modal boundary: focus trap, Escape and top-layer stacking come from the browser. */
export default function FocusDialog({
  open,
  title,
  language,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  language: Language;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    heading = useId();
  useLayoutEffect(() => {
    if (!open) return;
    const node = ref.current;
    if (!node) return;
    node.showModal();
    return () => {
      if (node.open) node.close();
    };
  }, [open]);
  if (!open) return null;
  return createPortal(
    <dialog
      ref={ref}
      className="wilo-focus-dialog"
      aria-labelledby={heading}
      dir={language === "en" ? "ltr" : "rtl"}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") e.stopPropagation();
      }}
      onClick={(e) => {
        if (e.target !== e.currentTarget) return;
        const box = e.currentTarget.getBoundingClientRect();
        if (
          e.clientX < box.left ||
          e.clientX > box.right ||
          e.clientY < box.top ||
          e.clientY > box.bottom
        )
          onClose();
      }}
    >
      <header>
        <h2 id={heading}>{title}</h2>
        <button type="button" className="secondary-button" onClick={onClose}>
          {language === "ar" ? "إغلاق" : language === "he" ? "סגירה" : "Close"}
        </button>
      </header>
      <div className="wilo-focus-dialog-content">{children}</div>
    </dialog>,
    document.body,
  );
}

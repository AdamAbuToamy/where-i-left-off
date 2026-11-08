import { createPortal } from "react-dom";
import { useEffect, useLayoutEffect, useRef } from "react";
import type { Language } from "../translations";
export default function ArrivalScene({
  language,
  onComplete,
}: {
  language: Language;
  onComplete: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    skip = useRef<HTMLButtonElement>(null),
    done = useRef(onComplete);
  useLayoutEffect(() => {
    done.current = onComplete;
  }, [onComplete]);
  const label = {
    ar: "دخول مساحة العمل",
    en: "Entering your workspace",
    he: "כניסה למרחב העבודה",
  }[language];
  useEffect(() => {
    const original = document.activeElement as HTMLElement | null;
    const element = dialog.current!;
    element.showModal();
    skip.current?.focus({ preventScroll: true });
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const reduce = () => {
      if (reduced.matches) done.current();
    };
    reduced.addEventListener("change", reduce);
    const timer = setTimeout(() => done.current(), 1900);
    return () => {
      clearTimeout(timer);
      reduced.removeEventListener("change", reduce);
      element.close();
      if (original?.isConnected) original.focus({ preventScroll: true });
      else
        (
          document.querySelector<HTMLElement>(".tour-popover h2") ||
          document.getElementById("wilo-main")
        )?.focus({ preventScroll: true });
    };
  }, []);
  return createPortal(
    <dialog
      ref={dialog}
      onCancel={(event) => {
        event.preventDefault();
        done.current();
      }}
      className="auth-arrival"
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          done.current();
        }
        if (event.key === "Tab") {
          event.preventDefault();
          skip.current?.focus();
        }
      }}
    >
      <div className="entry-shutter entry-left" aria-hidden="true" />
      <div className="entry-shutter entry-right" aria-hidden="true" />
      <div className="entry-rail" aria-hidden="true" />
      <div className="entry-brand" aria-hidden="true">
        <strong>WILO</strong>
        <span>WHERE I LEFT OFF</span>
      </div>
      <button ref={skip} type="button" onClick={() => done.current()}>
        {language === "ar"
          ? "تخطي الحركة"
          : language === "he"
            ? "דילוג על התנועה"
            : "Skip animation"}
      </button>
    </dialog>,
    document.body,
  );
}

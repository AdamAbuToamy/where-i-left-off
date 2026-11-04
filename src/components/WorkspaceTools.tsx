import { createPortal } from "react-dom";
import { usePhoneLayout } from "./usePhoneSurface";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { SlidersHorizontal, MoreHorizontal, X } from "lucide-react";
import type { Language } from "../translations";
import { useDesignPreview } from "./designPreviewContext";
const words = { ar: "أدوات العرض", he: "כלי תצוגה", en: "View tools" };
export default function WorkspaceTools({
  children,
  language,
  search,
  primary,
  status,
}: {
  children: ReactNode;
  language: Language;
  search?: ReactNode;
  primary?: ReactNode;
  status?: ReactNode;
}) {
  const { enabled, kitchenStudy } = useDesignPreview();
  const phone = usePhoneLayout(),
    phoneDialog = useRef<HTMLDialogElement>(null),
    [phoneTools, setPhoneTools] = useState(false);
  useEffect(() => {
    if (!phoneTools) return;
    const node = phoneDialog.current;
    node?.showModal();
    return () => node?.close();
  }, [phoneTools]);
  const triggerLabel = kitchenStudy
    ? { ar: "المزيد", en: "More", he: "עוד" }[language]
    : words[language];
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});
  const [opensUp, setOpensUp] = useState(false);
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
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
  useEffect(() => {
    const other = (event: Event) => {
      const source = (event as CustomEvent).detail?.trigger;
      if (source instanceof Node && !root.current?.contains(source))
        setOpen(false);
    };
    window.addEventListener("wilo-choice-open", other);
    return () => window.removeEventListener("wilo-choice-open", other);
  }, []);
  useEffect(() => {
    if (!open)
      panel.current?.querySelectorAll("details").forEach((details) => {
        details.open = false;
      });
  }, [open]);
  const updatePlacement = useCallback(() => {
    const rect = trigger.current?.getBoundingClientRect();
    if (rect) {
      const below = innerHeight - rect.bottom - 20,
        above = rect.top - 20,
        up = below < 240 && above > below;
      setOpensUp(up);
      setPanelStyle({
        maxHeight: Math.max(100, Math.min(600, up ? above : below)),
        ...(up
          ? {
              top: "auto",
              bottom: "calc(100% + 10px)",
              transformOrigin: "bottom",
            }
          : {}),
      });
    }
  }, []);
  useEffect(() => {
    if (!open) return;
    const update = () => updatePlacement();
    // Expanding sections or loading a route can move the anchor without a window resize.
    const observer = new ResizeObserver(update);
    for (const element of [
      root.current,
      panel.current,
      root.current?.closest(".workspace"),
    ]) {
      if (element) observer.observe(element);
    }
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, updatePlacement]);
  function reveal() {
    window.dispatchEvent(
      new CustomEvent("wilo-choice-open", {
        detail: { id: "more-" + id, trigger: trigger.current },
      }),
    );
    updatePlacement();
    setOpen(true);
  }
  if (kitchenStudy && phone)
    return (
      <div className="phone-workspace-actions">
        <button
          type="button"
          className="secondary-button phone-tools-button"
          aria-label={words[language]}
          onClick={() => setPhoneTools(true)}
        >
          <SlidersHorizontal size={20} />
        </button>
        {phoneTools &&
          createPortal(
            <dialog
              ref={phoneDialog}
              className="phone-workspace-tools"
              aria-label={words[language]}
              onCancel={(event) => {
                event.preventDefault();
                setPhoneTools(false);
              }}
            >
              <header>
                <h2>{words[language]}</h2>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setPhoneTools(false)}
                >
                  {language === "ar"
                    ? "رجوع"
                    : language === "he"
                      ? "חזרה"
                      : "Back"}
                </button>
              </header>
              <div className="phone-tools-content">
                {primary}
                {status && (
                  <section className="phone-tools-status">{status}</section>
                )}
                <section className="phone-tools-export">{children}</section>
              </div>
              <button
                type="button"
                className="primary-button"
                onClick={() => setPhoneTools(false)}
              >
                {language === "ar"
                  ? "عرض النتائج"
                  : language === "he"
                    ? "הצגת תוצאות"
                    : "Show results"}
              </button>
            </dialog>,
            document.body,
          )}
      </div>
    );
  if (!enabled) return <>{children}</>;
  if (kitchenStudy)
    return (
      <div className="search-toolbar workspace-search-tools">
        {search}
        {primary}
        <div className="workspace-export-control">{children}</div>
      </div>
    );
  return (
    <div className="search-toolbar workspace-search-tools">
      {search}
      {primary}
      <aside
        ref={root}
        className={`workspace-tools-dock ${open ? "is-open" : ""} ${opensUp ? "opens-up" : ""}`}
        onPointerEnter={(event) => {
          if (event.pointerType === "mouse") reveal();
        }}
        onPointerLeave={(event) => {
          if (
            event.pointerType === "mouse" &&
            !root.current?.contains(document.activeElement)
          )
            setOpen(false);
        }}
        onBlur={(event) => {
          if (
            event.relatedTarget instanceof Node &&
            !event.currentTarget.contains(event.relatedTarget)
          )
            setOpen(false);
        }}
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
          aria-label={triggerLabel}
          title={open ? undefined : triggerLabel}
          aria-expanded={open}
          aria-controls={id}
          onClick={(event) => {
            if (
              "pointerType" in event.nativeEvent &&
              event.nativeEvent.pointerType === "mouse"
            )
              reveal();
            else if (open) setOpen(false);
            else reveal();
          }}
        >
          {kitchenStudy ? (
            <MoreHorizontal size={19} aria-hidden="true" />
          ) : open ? (
            <X size={19} aria-hidden="true" />
          ) : (
            <SlidersHorizontal size={19} aria-hidden="true" />
          )}
          {triggerLabel}
        </button>
        <div
          ref={panel}
          className="workspace-tools-panel"
          id={id}
          inert={!open}
          style={panelStyle}
        >
          {children}
        </div>
      </aside>
    </div>
  );
}

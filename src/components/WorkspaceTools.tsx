import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import type { Language } from "../translations";
import { useDesignPreview } from "./designPreviewContext";
const words = { ar: "أدوات العرض", he: "כלי תצוגה", en: "View tools" };
export default function WorkspaceTools({
  children,
  language,
  search,
}: {
  children: ReactNode;
  language: Language;
  search?: ReactNode;
}) {
  const { enabled } = useDesignPreview();
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});
  const [opensUp, setOpensUp] = useState(false);
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
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, updatePlacement]);
  function reveal() {
    updatePlacement();
    setOpen(true);
  }
  if (!enabled) return <>{children}</>;
  return (
    <div className="search-toolbar workspace-search-tools">
      {search}
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
          if (!event.currentTarget.contains(event.relatedTarget))
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
          {open ? (
            <X size={19} aria-hidden="true" />
          ) : (
            <SlidersHorizontal size={19} aria-hidden="true" />
          )}
          {words[language]}
        </button>
        <div
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

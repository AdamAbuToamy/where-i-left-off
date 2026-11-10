import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { useDesignPreview } from "./designPreviewContext";
type Option = { value: string; label: string };
export default function ChoicePicker({
  label,
  value,
  options,
  onChange,
  hoverOpen = false,
}: {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  hoverOpen?: boolean;
}) {
  const { enabled } = useDesignPreview();
  const id = useId();
  const button = useRef<HTMLButtonElement>(null),
    panel = useRef<HTMLDivElement>(null);
  const [portalRoot, setPortalRoot] = useState<HTMLElement>(
    () => document.body,
  );
  const [open, setOpen] = useState(false),
    [active, setActive] = useState(0),
    [placement, setPlacement] = useState({
      left: 0,
      top: 0,
      width: 220,
      maxHeight: 320,
      position: "fixed" as "fixed" | "absolute",
    });
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const cancelClose = () => clearTimeout(closeTimer.current);
  const leave = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 220);
  };
  useEffect(() => {
    const other = (event: Event) => {
      if ((event as CustomEvent).detail?.id !== id) setOpen(false);
    };
    window.addEventListener("wilo-choice-open", other);
    return () => {
      clearTimeout(closeTimer.current);
      window.removeEventListener("wilo-choice-open", other);
    };
  }, [id]);
  const selected = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  function reveal() {
    cancelClose();
    window.dispatchEvent(
      new CustomEvent("wilo-choice-open", {
        detail: { id, trigger: button.current },
      }),
    );
    setPortalRoot(button.current?.closest("dialog[open]") || document.body);
    setActive(selected);
    setOpen(true);
  }
  function choose(index: number) {
    const option = options[index];
    if (option) {
      onChange(option.value);
      setOpen(false);
    }
  }
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = button.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(Math.max(rect.width, 220), innerWidth - 24);
      const below = innerHeight - rect.bottom - 16;
      const up = below < 200 && rect.top > below;
      const maxHeight = Math.max(80, Math.min(320, up ? rect.top - 16 : below));
      const left = Math.max(12, Math.min(rect.left, innerWidth - width - 12)),
        top = up
          ? Math.max(
              12,
              rect.top - Math.min(options.length * 44 + 12, maxHeight) - 8,
            )
          : rect.bottom + 8,
        root =
          portalRoot.tagName === "DIALOG"
            ? portalRoot.getBoundingClientRect()
            : null;
      setPlacement({
        left: left - (root?.left || 0) + (root ? portalRoot.scrollLeft : 0),
        top: top - (root?.top || 0) + (root ? portalRoot.scrollTop : 0),
        width,
        maxHeight,
        position: root ? "absolute" : "fixed",
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!button.current?.contains(target) && !panel.current?.contains(target))
        setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      document.removeEventListener("pointerdown", outside);
    };
  }, [open, options.length, portalRoot]);
  useEffect(() => {
    if (open)
      panel.current
        ?.querySelector('[data-active="true"]')
        ?.scrollIntoView({ block: "nearest" });
  }, [active, open]);
  if (!enabled)
    return (
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  return (
    <>
      <button
        ref={button}
        type="button"
        className={`choice-picker-trigger${open ? " is-open" : ""}`}
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-haspopup="listbox"
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        onPointerEnter={(event) => {
          if (hoverOpen && event.pointerType === "mouse" && innerWidth > 600)
            reveal();
        }}
        onPointerLeave={(event) => {
          if (
            hoverOpen &&
            event.pointerType === "mouse" &&
            innerWidth > 600 &&
            !panel.current?.contains(event.relatedTarget as Node)
          )
            leave();
        }}
        onClick={(event) => {
          if (
            hoverOpen &&
            innerWidth > 600 &&
            "pointerType" in event.nativeEvent &&
            event.nativeEvent.pointerType === "mouse"
          )
            reveal();
          else if (open) setOpen(false);
          else reveal();
        }}
        onBlur={() => setOpen(false)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            if (!open) reveal();
            else
              setActive(
                (index) =>
                  (index +
                    (event.key === "ArrowDown" ? 1 : -1) +
                    options.length) %
                  options.length,
              );
          } else if (event.key === "Home" || event.key === "End") {
            event.preventDefault();
            setOpen(true);
            setActive(event.key === "Home" ? 0 : options.length - 1);
          } else if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            if (open) choose(active);
            else reveal();
          } else if (event.key === "Escape") {
            event.preventDefault();
            setOpen(false);
          } else if (event.key === "Tab") setOpen(false);
        }}
      >
        <span>{options[selected]?.label}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open &&
        createPortal(
          <>
            <div
              className="choice-focus-backdrop"
              style={{ position: placement.position }}
              aria-hidden="true"
            />
            <header className="choice-phone-heading">
              <strong>{label}</strong>
              <button
                type="button"
                aria-label={
                  document.documentElement.lang === "ar" ? "رجوع" : "Back"
                }
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => {
                  setOpen(false);
                  button.current?.focus();
                }}
              >
                ×
              </button>
            </header>
            <div
              ref={panel}
              id={id}
              className="choice-picker-panel"
              role="listbox"
              aria-label={label}
              style={placement}
              onPointerEnter={cancelClose}
              onPointerLeave={(event) => {
                if (
                  hoverOpen &&
                  event.pointerType === "mouse" &&
                  !button.current?.contains(event.relatedTarget as Node)
                )
                  leave();
              }}
            >
              {options.map((option, index) => (
                <div
                  key={option.value}
                  id={`${id}-${index}`}
                  role="option"
                  aria-selected={value === option.value}
                  data-active={active === index}
                  className="choice-picker-option"
                  onPointerEnter={() => setActive(index)}
                  onPointerDown={(event) => event.preventDefault()}
                  onClick={() => choose(index)}
                >
                  <span>{option.label}</span>
                  {value === option.value && (
                    <Check size={16} aria-hidden="true" />
                  )}
                </div>
              ))}
            </div>
          </>,
          portalRoot,
        )}
    </>
  );
}

import { createPortal } from "react-dom";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Compass,
  X,
} from "lucide-react";
import type { User } from "firebase/auth";
import type { Language } from "../translations";
import { route } from "../lib/navigation";
import { isAdmin } from "../lib/admin";
import { tourText } from "../tourText";
import { tourGeometry } from "./tourGeometry";
import type { TourRect } from "./tourGeometry";
import "./WelcomeTour.css";

const storageKey = (uid: string) => `welcome-tour:v2:${uid}`;
const desktopQuery = "(min-width:1024px) and (pointer:fine)";
const desktopAvailable = () =>
  window.matchMedia?.(desktopQuery).matches ?? true;
const currentHash = () => location.hash.replace(/^#/, "") || "/personal";
function shouldOpen(user: User) {
  try {
    if (localStorage.getItem(storageKey(user.uid))) return false;
  } catch {
    /* Optional preference. */
  }
  const created = Date.parse(user.metadata.creationTime || "");
  return (
    route().page === "personal" &&
    !new URLSearchParams(location.search).has("groupInvite") &&
    new URLSearchParams(location.search).get("capture") !== "tab" &&
    Number.isFinite(created) &&
    Date.now() - created < 86400000
  );
}
const visible = (node: HTMLElement) => {
  const rect = node.getBoundingClientRect();
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    getComputedStyle(node).visibility !== "hidden"
  );
};
const focusable =
  "button:not(:disabled),a[href],summary,[tabindex]:not([tabindex='-1'])";
/** Read-only guided navigation: no simulated app actions, writes or provider requests. */
export default function WelcomeTour({
  user,
  language,
}: {
  user: User;
  language: Language;
}) {
  const [open, setOpen] = useState(() => shouldOpen(user));
  const [stepId, setStepId] = useState("cards"),
    [desktop, setDesktop] = useState(desktopAvailable),
    [hash, setHash] = useState(currentHash);
  const [anchor, setAnchor] = useState<TourRect | null>(null),
    [fallback, setFallback] = useState(false);
  const [viewport, setViewport] = useState({
      width: innerWidth,
      height: innerHeight,
    }),
    [cardSize, setCardSize] = useState({ width: 420, height: 340 });
  const layer = useRef<HTMLDivElement>(null),
    card = useRef<HTMLElement>(null),
    heading = useRef<HTMLHeadingElement>(null),
    target = useRef<HTMLElement | null>(null),
    previousFocus = useRef<HTMLElement | null>(null);
  const indexMenu = useRef<HTMLDetailsElement>(null),
    titleId = useId(),
    bodyId = useId();
  const t = tourText[language];
  const admin = isAdmin(user.email, user.emailVerified);
  const steps = useMemo(
    () =>
      t.steps.filter(
        (step) => (!step.desktopOnly || desktop) && (!step.adminOnly || admin),
      ),
    [t, desktop, admin],
  );
  const index = Math.max(
      0,
      steps.findIndex((step) => step.id === stepId),
    ),
    current = steps[index];
  const offPage = hash !== current.hash;
  const geometry = tourGeometry(offPage ? null : anchor, viewport, cardSize);
  const finish = (explore = false) => {
    try {
      localStorage.setItem(storageKey(user.uid), "done");
    } catch {
      /* Dismiss this session even if storage is unavailable. */
    }
    const destination = explore ? target.current : previousFocus.current;
    setOpen(false);
    requestAnimationFrame(() => {
      let candidate = destination?.isConnected
        ? destination
        : document.getElementById("wilo-main");
      if (explore && candidate) {
        let ancestor = candidate.parentElement;
        while (ancestor) {
          if (ancestor instanceof HTMLDetailsElement) ancestor.open = true;
          ancestor = ancestor.parentElement;
        }
      }
      if (!candidate || !visible(candidate))
        candidate = document.getElementById("wilo-main");
      if (!candidate) return;
      if (!candidate.matches("button,a,summary,[tabindex]")) {
        const node = candidate;
        node.setAttribute("tabindex", "-1");
        node.addEventListener(
          "blur",
          () => {
            if (node.getAttribute("tabindex") === "-1")
              node.removeAttribute("tabindex");
          },
          { once: true },
        );
      }
      candidate.focus({ preventScroll: true });
    });
  };

  const go = (next: number) => {
    indexMenu.current?.removeAttribute("open");
    const nextId = steps[Math.max(0, Math.min(next, steps.length - 1))].id;
    if (nextId === current.id) heading.current?.focus({ preventScroll: true });
    setStepId(nextId);
  };
  useEffect(() => {
    let waiting: MutationObserver | null = null;
    const replay = () => {
      waiting?.disconnect();
      const begin = () => {
        if (
          document.querySelector(
            "dialog[open],#new-project-panel.is-open,.phone-form-fullscreen,.phone-card-fullscreen,.desktop-card-panel,.card-editor",
          )
        )
          return false;
        waiting?.disconnect();
        waiting = null;
        setStepId("cards");
        setOpen(true);
        return true;
      };
      if (!begin()) {
        waiting = new MutationObserver(() => {
          begin();
        });
        waiting.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["class", "open"],
        });
      }
    };
    const changed = () => setHash(currentHash());
    const resized = () => {
      const enabled = desktopAvailable();
      setDesktop(enabled);
      if (!enabled) setStepId((id) => (id === "board" ? "resume" : id));
    };
    window.addEventListener("replay-welcome-tour", replay);
    window.addEventListener("hashchange", changed);
    window.addEventListener("resize", resized);
    return () => {
      waiting?.disconnect();
      window.removeEventListener("replay-welcome-tour", replay);
      window.removeEventListener("hashchange", changed);
      window.removeEventListener("resize", resized);
    };
  }, []);
  useEffect(() => {
    if (open && currentHash() !== current.hash) location.hash = current.hash;
  }, [open, current.hash]);
  useLayoutEffect(() => {
    if (!open || !layer.current) return;
    previousFocus.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const saved = new Map<HTMLElement, boolean>(),
      overflow = document.body.style.overflow;
    const isolate = () => {
      for (const node of document.body.children)
        if (
          node instanceof HTMLElement &&
          !node.contains(layer.current) &&
          !saved.has(node)
        ) {
          saved.set(node, node.hasAttribute("inert"));
          node.setAttribute("inert", "");
        }
    };
    isolate();
    const observer = new MutationObserver(isolate);
    observer.observe(document.body, { childList: true });
    document.body.style.overflow = "hidden";
    document.body.dataset.tourActive = "true";
    return () => {
      observer.disconnect();
      for (const [node, inert] of saved) node.toggleAttribute("inert", inert);
      document.body.style.overflow = overflow;
      delete document.body.dataset.tourActive;
    };
  }, [open]);
  useLayoutEffect(() => {
    if (!open) return;
    heading.current?.focus({ preventScroll: true });
    if (offPage) {
      target.current = null;
      return;
    }
    let frame = 0,
      stopped = false,
      scrolled: HTMLElement | null = null,
      allowFallback = false;
    const details = new Map<HTMLDetailsElement, boolean>();
    for (const node of document.querySelectorAll<HTMLDetailsElement>("details"))
      if (!layer.current?.contains(node)) details.set(node, node.open);
    const blurred = new Map<HTMLElement, string>();
    const restoreBlur = () => {
      for (const [node, filter] of blurred) node.style.filter = filter;
      blurred.clear();
    };
    const blurAround = (node: HTMLElement) => {
      restoreBlur();
      let branch: HTMLElement = node;
      while (branch.parentElement) {
        for (const sibling of branch.parentElement.children)
          if (
            sibling instanceof HTMLElement &&
            sibling !== branch &&
            sibling !== layer.current &&
            !sibling.contains(layer.current)
          ) {
            blurred.set(sibling, sibling.style.filter);
            sibling.style.filter = "blur(3px)";
          }
        if (branch.parentElement === document.body) break;
        branch = branch.parentElement;
      }
    };
    const reveal = (node: HTMLElement) => {
      const parents: HTMLDetailsElement[] = [];
      let parent = node.parentElement;
      while (parent) {
        if (parent instanceof HTMLDetailsElement) parents.unshift(parent);
        parent = parent.parentElement;
      }
      for (const item of parents) item.open = true;
    };
    const measure = () => {
      frame = 0;
      if (stopped) return;
      let element: HTMLElement | null = null;
      for (const selector of current.targets) {
        for (const item of document.querySelectorAll<HTMLElement>(selector)) {
          reveal(item);
          if (visible(item)) {
            element = item;
            break;
          }
        }
        if (element) break;
      }
      const exact = !!element;
      if (!element && allowFallback) {
        const main = document.getElementById("wilo-main");
        if (main && visible(main)) element = main;
      }
      if (element && element !== scrolled) {
        element.scrollIntoView?.({
          block: "center",
          inline: "nearest",
          behavior: "instant",
        });
        scrolled = element;
      }
      target.current = element;
      if (element) blurAround(element);
      else restoreBlur();
      const view = window.visualViewport;
      setViewport((old) => {
        const next = {
          width: view?.width || innerWidth,
          height: view?.height || innerHeight,
        };
        return old.width === next.width && old.height === next.height
          ? old
          : next;
      });
      const bounds = element?.getBoundingClientRect();
      const next = bounds
        ? {
            x: bounds.x - (view?.offsetLeft || 0),
            y: bounds.y - (view?.offsetTop || 0),
            width: bounds.width,
            height: bounds.height,
          }
        : null;
      setAnchor((old) =>
        old &&
        next &&
        Math.abs(old.x - next.x) < 0.5 &&
        Math.abs(old.y - next.y) < 0.5 &&
        Math.abs(old.width - next.width) < 0.5 &&
        Math.abs(old.height - next.height) < 0.5
          ? old
          : next,
      );
      setFallback(!exact && allowFallback);
      const rect = card.current?.getBoundingClientRect();
      if (rect?.height)
        setCardSize((old) =>
          Math.abs(old.height - rect.height) < 0.5
            ? old
            : { width: 420, height: rect.height },
        );
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    const resize =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(schedule)
        : null;
    if (card.current) resize?.observe(card.current);
    const delayed = setTimeout(() => {
      allowFallback = true;
      schedule();
    }, 300);
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    window.visualViewport?.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("scroll", schedule);
    measure();
    return () => {
      stopped = true;
      restoreBlur();
      cancelAnimationFrame(frame);
      clearTimeout(delayed);
      observer.disconnect();
      resize?.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
      window.visualViewport?.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("scroll", schedule);
      for (const [node, wasOpen] of details)
        if (node.isConnected) node.open = wasOpen;
    };
  }, [open, current, offPage]);
  // Keep keyboard users in the explanation; Explore explicitly returns control to the app.
  useEffect(() => {
    if (!open) return;
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        finish();
      }
      if (event.key !== "Tab") return;
      const controls = Array.from(
        card.current?.querySelectorAll<HTMLElement>(focusable) || [],
      ).filter(visible);
      if (!controls.length) return;
      const position = controls.indexOf(document.activeElement as HTMLElement);
      if (event.shiftKey && position <= 0) {
        event.preventDefault();
        controls.at(-1)?.focus();
      } else if (
        !event.shiftKey &&
        (position < 0 || position === controls.length - 1)
      ) {
        event.preventDefault();
        controls[0].focus();
      }
    };
    document.addEventListener("keydown", keyboard, true);
    return () => document.removeEventListener("keydown", keyboard, true);
  });
  if (!open) return null;
  const focus = geometry.focus,
    box = geometry.card;
  const clip = focus
    ? `polygon(evenodd,0 0,100% 0,100% 100%,0 100%,0 0,${focus.x}px ${focus.y}px,${focus.x}px ${focus.y + focus.height}px,${focus.x + focus.width}px ${focus.y + focus.height}px,${focus.x + focus.width}px ${focus.y}px,${focus.x}px ${focus.y}px)`
    : undefined;
  return createPortal(
    <div
      ref={layer}
      className="tour-layer"
      dir={language === "en" ? "ltr" : "rtl"}
      style={{
        top: window.visualViewport?.offsetTop || 0,
        left: window.visualViewport?.offsetLeft || 0,
        width: viewport.width,
        height: viewport.height,
      }}
    >
      <div
        className="tour-scrim"
        style={{ clipPath: clip }}
        aria-hidden="true"
      />
      {focus && (
        <div
          className="tour-focus"
          style={{
            left: focus.x,
            top: focus.y,
            width: focus.width,
            height: focus.height,
          }}
          aria-hidden="true"
        >
          <span>{index + 1}</span>
        </div>
      )}
      <aside
        ref={card}
        className="welcome-guide tour-popover"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        data-tour-step={current.id}
        data-index-up={box.y > viewport.height / 2}
        style={{
          left: box.x,
          top: box.y,
          width: box.width,
          maxHeight: viewport.height - 24,
        }}
      >
        <header className="guide-heading">
          <Compass size={19} aria-hidden="true" />
          <strong>{t.quick}</strong>
          <button
            className="guide-skip"
            type="button"
            aria-label={t.skip}
            onClick={() => finish()}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>
        <details className="tour-chapters" ref={indexMenu}>
          <summary>
            {t.chapters[current.chapter]}
            <span dir="ltr">
              {index + 1} / {steps.length}
            </span>
            <ChevronDown size={15} aria-hidden="true" />
          </summary>
          <nav className="tour-index-panel" aria-label={t.browse}>
            {steps.map((step, i) => (
              <button
                type="button"
                key={step.id}
                aria-current={i === index ? "step" : undefined}
                onClick={() => go(i)}
              >
                <small>{i + 1}</small>
                {step.title}
              </button>
            ))}
          </nav>
        </details>
        <div
          className="guide-copy"
          key={`${language}/${current.id}`}
          aria-live="polite"
        >
          <h2 id={titleId} tabIndex={-1} ref={heading}>
            {current.title}
          </h2>
          <p id={bodyId}>{current.body}</p>
        </div>
        {offPage && (
          <button
            type="button"
            className="tour-return"
            onClick={() => {
              location.hash = current.hash;
            }}
          >
            {t.returnStep}
          </button>
        )}
        {fallback && !offPage && <p className="tour-fallback">{t.fallback}</p>}
        <div className="guide-progress" aria-hidden="true">
          <span style={{ width: `${((index + 1) / steps.length) * 100}%` }} />
        </div>
        <div className="guide-bottom">
          <button
            type="button"
            className="tour-back"
            disabled={!index}
            onClick={() => go(index - 1)}
          >
            {language === "en" ? (
              <ChevronLeft size={17} />
            ) : (
              <ChevronRight size={17} />
            )}{" "}
            {t.back}
          </button>
          <button
            type="button"
            className="tour-next"
            onClick={() =>
              index === steps.length - 1 ? finish() : go(index + 1)
            }
          >
            {index === steps.length - 1 ? t.start : t.next}
            {language === "en" ? (
              <ChevronRight size={17} />
            ) : (
              <ChevronLeft size={17} />
            )}
          </button>
        </div>
        <button
          type="button"
          className="tour-explore"
          onClick={() => finish(true)}
        >
          {t.tryIt}
        </button>
      </aside>
    </div>,
    document.body,
  );
}

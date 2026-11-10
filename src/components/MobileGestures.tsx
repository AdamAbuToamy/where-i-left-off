import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Language } from "../translations";
import { readExperience } from "../experience/preferences";
import "./MobileGestures.css";

const phoneQuery = "(max-width: 767px) and (pointer: coarse)";
const labels = {
  ar: ["اسحب للتحديث", "اترك للتحديث", "جارٍ تحديث ويلو"],
  en: ["Pull to refresh", "Release to refresh", "Refreshing Wilo"],
  he: ["משיכה לרענון", "שחרור לרענון", "מרענן את Wilo"],
};

/** Touch-only browser boundary. Never claims gestures inside editors or dialogs. */
export default function MobileGestures({
  uid,
  language,
}: {
  uid: string;
  language: Language;
}) {
  const [visual, setVisual] = useState({ pull: 0, refreshing: false });
  const busy = useRef(false);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = matchMedia(phoneQuery);
    let start: { x: number; y: number; top: boolean } | null = null;
    let mode = "",
      pull = 0,
      timer = 0;
    const root = document.documentElement;
    const reset = () => {
      start = null;
      mode = "";
      pull = 0;
      root.style.removeProperty("--wilo-pull");
      root.classList.remove("wilo-pull-active");
      setVisual({ pull: 0, refreshing: false });
    };
    const eligibility = () =>
      root.classList.toggle("wilo-phone-gestures", media.matches);
    eligibility();
    media.addEventListener("change", eligibility);
    const begin = (event: TouchEvent) => {
      start = null;
      if (!media.matches || busy.current || event.touches.length !== 1) return;
      const target = event.target;
      if (
        !(target instanceof Element) ||
        target.closest(
          'input,textarea,select,[contenteditable="true"],[draggable="true"],dialog[open],[role="dialog"],.journey-coach',
        )
      )
        return;
      if (document.querySelector('dialog[open],[aria-modal="true"]')) return;
      let node: Element | null = target;
      while (node && node !== document.body) {
        const css = getComputedStyle(node);
        if (
          /(auto|scroll)/.test(css.overflowY) &&
          node.scrollHeight > node.clientHeight + 1
        )
          return;
        node = node.parentElement;
      }
      const t = event.touches[0];
      start = {
        x: t.clientX,
        y: t.clientY,
        top: window.scrollY <= 1,
      };
    };
    const move = (event: TouchEvent) => {
      if (!start || busy.current) return;
      if (event.touches.length !== 1) {
        reset();
        return;
      }
      const dx = event.touches[0].clientX - start.x,
        dy = event.touches[0].clientY - start.y;
      if (!mode && Math.max(Math.abs(dx), Math.abs(dy)) > 10) {
        if (start.top && dy > 0 && dy > Math.abs(dx) * 1.5) mode = "pull";
        else {
          reset();
          return;
        }
      }
      if (!mode) return;
      if (!event.cancelable) {
        reset();
        return;
      }
      event.preventDefault();
      pull = mode === "pull" ? Math.min(126, Math.max(0, dy) * 0.42) : 0;
      const motion =
        readExperience(uid).motion &&
        !matchMedia("(prefers-reduced-motion: reduce)").matches;
      root.classList.toggle("wilo-pull-active", motion && pull > 0);
      root.style.setProperty("--wilo-pull", `${motion ? pull : 0}px`);
      setVisual({ pull, refreshing: false });
    };
    const end = () => {
      if (!start) return;
      const refresh = mode === "pull" && pull >= 84;
      reset();
      if (refresh) {
        busy.current = true;
        root.classList.add("wilo-pull-active");
        setVisual({ pull: 84, refreshing: true });
        root.style.setProperty(
          "--wilo-pull",
          readExperience(uid).motion &&
            !matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "84px"
            : "0px",
        );
        // The browser's existing beforeunload protection still guards unsaved work.
        timer = window.setTimeout(() => {
          window.location.reload();
          busy.current = false;
          reset();
        }, 600);
      }
    };
    document.addEventListener("touchstart", begin, { passive: true });
    document.addEventListener("touchmove", move, { passive: false });
    document.addEventListener("touchend", end);
    document.addEventListener("touchcancel", reset);
    return () => {
      clearTimeout(timer);
      media.removeEventListener("change", eligibility);
      document.removeEventListener("touchstart", begin);
      document.removeEventListener("touchmove", move);
      document.removeEventListener("touchend", end);
      document.removeEventListener("touchcancel", reset);
      root.classList.remove("wilo-phone-gestures");
      root.style.removeProperty("--wilo-pull");
      root.classList.remove("wilo-pull-active");
    };
  }, [uid]);
  const t = labels[language];
  return createPortal(
    <>
      <div
        className={`wilo-refresh ${visual.refreshing ? "is-refreshing" : ""}`}
        data-visible={visual.pull > 0}
        role="status"
        aria-live="polite"
      >
        <img
          src="/app-icon-192.9a457243da2f.png"
          alt=""
          style={{ transform: `rotate(${visual.pull * 2.5}deg)` }}
        />
        <span>{t[visual.refreshing ? 2 : visual.pull >= 84 ? 1 : 0]}</span>
      </div>
    </>,
    document.body,
  );
}

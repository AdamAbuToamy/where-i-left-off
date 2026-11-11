import { companionRelease } from "./release";
import { useEffect, useMemo, useRef, useState } from "react";
import { X, Settings } from "lucide-react";
import type { Language } from "../translations";
import type { PageName } from "../lib/navigation";
import JourneyCompanion from "../components/JourneyCompanion";
import { revealJourneyTarget } from "../components/journeyScroll";
import { loadExtensionConfig } from "../lib/extensionConfig";
import {
  desktopChromium,
  detectExtension,
  shouldOffer,
  storeUrl,
  readInstallPreference,
  saveInstallPreference,
  SNOOZE_MS,
} from "../lib/extensionInstall";
import { companionFeedEvent, safeCompanionItems } from "./feed";
import {
  companionPreferenceEvent,
  companionStorageKey,
  readCompanionState,
  refreshCompanionState,
  rememberSuggestion,
  pauseCompanion,
  saveCompanionPreferences,
} from "./preferences";
import { companionHref, itemKey, selectSuggestion, DAY } from "./policy";
import type { CompanionItem, Suggestion } from "./policy";
import { companionText } from "./text";
import "../components/WelcomeTour.css";
import "./companion.css";
const workingPages: PageName[] = ["personal", "university", "resume", "groups"];
function blocked() {
  return (
    document.visibilityState !== "visible" ||
    !document.hasFocus() ||
    !navigator.onLine ||
    !!document.querySelector(
      'dialog[open],[aria-modal="true"],.journey-layer,.journey-welcome[open],.wilo-loading,.content-skeleton,.sleep-screen,.form-reveal.is-open',
    ) ||
    !!document.activeElement?.closest(
      'input,textarea,select,[contenteditable="true"]',
    )
  );
}
function selector(item: CompanionItem) {
  const id = CSS.escape(item.id);
  return item.kind === "card"
    ? `[data-project="${id}"]`
    : item.kind === "course"
      ? `[data-companion-course="${id}"], [data-study-course="${id}"]`
      : `[data-companion-task="${id}"]`;
}
/** Only local UI suggestions. Data comes from the currently authorized, mounted page. */
export default function ContextualCompanion({
  uid,
  language,
  page,
}: {
  uid: string;
  language: Language;
  page: PageName;
}) {
  const [preferences, setPreferences] = useState(
      () => readCompanionState(uid).preferences,
    ),
    [feeds, setFeeds] = useState<Record<string, CompanionItem[]>>({}),
    [hint, setHint] = useState<Suggestion | null>(null),
    [extensionUrl, setExtensionUrl] = useState<string | null>(null);
  const [target, setTarget] = useState<{
      href: string;
      selector: string;
      openCard?: boolean;
    } | null>(null),
    [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const [started] = useState(() => Date.now()),
    [displayTime, setDisplayTime] = useState(started);
  const lastActivity = useRef(started),
    shownAt = useRef(0),
    aside = useRef<HTMLElement>(null);
  const items = useMemo(() => Object.values(feeds).flat(), [feeds]),
    t = companionText[language],
    allowed = workingPages.includes(page);
  useEffect(() => {
    const update = () => {
      const p = readCompanionState(uid).preferences;
      setPreferences(p);
      setHint((current) => (current && !p[current.category] ? null : current));
      if (!p.enabled) {
        setHint(null);
        setTarget(null);
        setFeeds({});
      }
      if (!p.enabled || !p.extension) setExtensionUrl(null);
    };
    const changed = (event: Event) => {
      if ((event as CustomEvent).detail?.uid === uid) update();
    };
    const storage = (event: StorageEvent) => {
      if (event.key === companionStorageKey(uid)) {
        refreshCompanionState(uid);
        update();
      }
    };
    window.addEventListener(companionPreferenceEvent, changed);
    window.addEventListener("storage", storage);
    return () => {
      window.removeEventListener(companionPreferenceEvent, changed);
      window.removeEventListener("storage", storage);
    };
  }, [uid]);
  useEffect(() => {
    if (!preferences.enabled) return;
    const receive = (event: Event) => {
      const value = (event as CustomEvent).detail;
      if (
        value?.uid !== uid ||
        !["personal", "university"].includes(value.scope)
      )
        return;
      const values = safeCompanionItems(value.items);
      setFeeds((current) => ({ ...current, [value.scope]: values }));
    };
    window.addEventListener(companionFeedEvent, receive);
    window.dispatchEvent(
      new CustomEvent("wilo-companion-request", { detail: { uid } }),
    );
    return () => window.removeEventListener(companionFeedEvent, receive);
  }, [uid, preferences.enabled]);
  useEffect(() => {
    if (!preferences.enabled || !preferences.extension || !desktopChromium())
      return;
    let active = true,
      checking = false;
    const check = async () => {
      if (checking || !active) return;
      checking = true;
      try {
        const config = await loadExtensionConfig();
        if (!config || !active) return;
        const found = await detectExtension(config.extensionId);
        if (active)
          setExtensionUrl(
            shouldOffer(config, readInstallPreference(), found)
              ? storeUrl(config)
              : null,
          );
      } catch {
        if (active) setExtensionUrl(null);
      } finally {
        checking = false;
      }
    };
    const recheck = () => {
      setExtensionUrl(null);
      void check();
    };
    void check();
    window.addEventListener("focus", recheck);
    window.addEventListener("online", recheck);
    return () => {
      active = false;
      window.removeEventListener("focus", recheck);
      window.removeEventListener("online", recheck);
    };
  }, [preferences.enabled, preferences.extension]);
  useEffect(() => {
    if (!preferences.enabled) return;
    const activity = (event: Event) => {
      lastActivity.current = Date.now();
      if (
        event.type === "pointerdown" &&
        event.target instanceof Node &&
        !aside.current?.contains(event.target)
      )
        setHint(null);
      if (
        (event.target as Element)?.closest?.(
          'input,textarea,select,[contenteditable="true"],dialog,[role="dialog"]',
        )
      )
        setHint(null);
    };
    const events = ["pointerdown", "keydown", "wheel", "touchstart", "focusin"];
    events.forEach((name) =>
      document.addEventListener(name, activity, { passive: true }),
    );
    const timer = window.setInterval(() => {
      if (!allowed || blocked()) {
        setHint(null);
        return;
      }
      if (hint) {
        if (
          hint.category === "deadlines" &&
          hint.item?.dueAt &&
          hint.item.dueAt <= Date.now()
        ) {
          setHint(null);
          return;
        }
        if (
          hint.item &&
          !items.some((x) => itemKey(x) === itemKey(hint.item!))
        ) {
          setHint(null);
          return;
        }
        if (
          Date.now() - shownAt.current > 60000 &&
          !aside.current?.contains(document.activeElement)
        )
          setHint(null);
        return;
      }
      const now = Date.now();
      if (now - started < 30000 || now - lastActivity.current < 5000) return;
      const next = selectSuggestion(
        items,
        readCompanionState(uid),
        now,
        !!extensionUrl &&
          !readInstallPreference().dismissed &&
          !readInstallPreference().manualInstalled &&
          Date.now() >= readInstallPreference().snoozedUntil,
      );
      if (next) {
        setDisplayTime(now);
        shownAt.current = now;
        rememberSuggestion(uid, next.key, now);
        setHint(next);
      }
    }, 5000);
    return () => {
      clearInterval(timer);
      events.forEach((name) => document.removeEventListener(name, activity));
    };
  }, [uid, allowed, preferences.enabled, items, hint, extensionUrl, started]);
  useEffect(() => {
    if (!hint?.item || !allowed) return;
    const node = document.querySelector<HTMLElement>(selector(hint.item));
    if (!node) return;
    let frame = 0;
    const place = () => {
      const panel = aside.current;
      if (!panel) return;
      const rect = node.getBoundingClientRect();
      const visible = rect.bottom > 0 && rect.top < innerHeight;
      node.classList.toggle("companion-attention", visible);
      let x: number | null = null;
      if (visible && innerWidth >= 900) {
        if (rect.left > 350) x = rect.left - 345;
        else if (innerWidth - rect.right > 350) x = rect.right + 14;
      }
      if (x !== null) {
        panel.style.left = `${x}px`;
        panel.style.top = `${Math.max(100, Math.min(innerHeight - panel.offsetHeight - 24, rect.top))}px`;
        panel.style.bottom = "auto";
      } else {
        panel.style.removeProperty("left");
        panel.style.removeProperty("top");
        panel.style.removeProperty("bottom");
      }
    };
    const position = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(place);
    };
    position();
    window.addEventListener("scroll", position, { passive: true });
    window.addEventListener("resize", position);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", position);
      window.removeEventListener("resize", position);
      node.classList.remove("companion-attention");
    };
  }, [hint, allowed]);
  useEffect(() => {
    if (!target || !preferences.enabled) return;
    location.hash = target.href;
    let node: HTMLElement | null = null,
      frame = 0,
      opened = false;
    const find = () => {
      const element = document.querySelector<HTMLElement>(target.selector);
      if (!element) return;
      if (target.openCard && !opened) {
        const button =
          element.querySelector<HTMLButtonElement>(".envelope-expand");
        if (button) {
          opened = true;
          button.click();
          return;
        }
      }
      if (node === element) return;
      node?.classList.remove("companion-attention");
      node = element;
      for (
        let parent = element.parentElement;
        parent;
        parent = parent.parentElement
      )
        if (parent instanceof HTMLDetailsElement) parent.open = true;
      frame = requestAnimationFrame(() => {
        if (!element.isConnected) return;
        revealJourneyTarget(element, {
          top: 0,
          left: 0,
          width: innerWidth,
          height: innerHeight,
        });
        element.classList.add("companion-attention");
        const box = element.getBoundingClientRect();
        if (!element.closest("dialog"))
          setPointer({
            x: Math.max(8, Math.min(innerWidth - 100, box.left)),
            y: Math.max(8, Math.min(innerHeight - 190, box.top - 105)),
          });
      });
    };
    const observer = new MutationObserver(find);
    observer.observe(document.body, { childList: true, subtree: true });
    find();
    const timer = window.setTimeout(() => {
      setTarget(null);
      setPointer(null);
    }, 6500);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      node?.classList.remove("companion-attention");
      setPointer(null);
    };
  }, [target, preferences.enabled]);
  function show() {
    if (!hint) return;
    setHint(null);
    if (hint.category === "extension") {
      saveInstallPreference({
        ...readInstallPreference(),
        snoozedUntil: Date.now() + SNOOZE_MS,
      });
      return;
    }
    if (hint.item)
      setTarget({
        href: companionHref(hint.item),
        selector:
          hint.item.kind === "task" ? ".study-dialog h2" : selector(hint.item),
        openCard: hint.item.kind === "card",
      });
    else
      setTarget({
        href: companionRelease.href,
        selector: companionRelease.selector,
      });
  }
  function settings() {
    setHint(null);
    setTarget({ href: "#/settings", selector: ".companion-settings" });
  }
  if (!preferences.enabled) return null;
  const relative = hint?.item?.dueAt
    ? (() => {
        const diff = Math.max(60000, hint.item.dueAt! - displayTime),
          unit = diff < 3600000 ? "minute" : diff < DAY ? "hour" : "day",
          count = Math.ceil(
            diff /
              (unit === "minute" ? 60000 : unit === "hour" ? 3600000 : DAY),
          );
        return new Intl.RelativeTimeFormat(language, {
          numeric: "always",
        }).format(count, unit);
      })()
    : "";
  const last = hint?.item
    ? readCompanionState(uid).visits[itemKey(hint.item)]
    : 0;
  return (
    <>
      {allowed && hint && (
        <aside
          ref={aside}
          className="context-companion"
          aria-label={t.name}
          data-companion-kind={hint.category}
          dir={language === "en" ? "ltr" : "rtl"}
        >
          <JourneyCompanion mood={hint.item ? "pointing" : "happy"} />
          <div className="companion-bubble">
            <button
              type="button"
              className="companion-close"
              aria-label={t.close}
              onClick={() => setHint(null)}
            >
              <X size={17} />
            </button>
            <span className="companion-name">{t.name}</span>
            <div role="status" aria-live="polite">
              <p>
                {hint.category === "deadlines" ? (
                  <>
                    {t.due} <bdi>{hint.item?.title}</bdi> — {relative}.
                  </>
                ) : hint.category === "stale" ? (
                  <>
                    {hint.item?.kind === "course" ? t.course : t.returnTo}{" "}
                    {new Intl.RelativeTimeFormat(language, {
                      numeric: "always",
                    }).format(
                      -Math.max(1, Math.floor((displayTime - last) / DAY)),
                      "day",
                    )}
                    : <bdi>{hint.item?.title}</bdi>.
                  </>
                ) : hint.category === "features" ? (
                  t.feature
                ) : (
                  t.extensionHint
                )}
              </p>
            </div>
            <div className="companion-actions">
              {hint.category === "extension" ? (
                <a
                  className="primary-button"
                  href={extensionUrl || undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={show}
                >
                  {t.install}
                </a>
              ) : (
                <button type="button" className="primary-button" onClick={show}>
                  {hint.item ? t.show : t.try}
                </button>
              )}
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  pauseCompanion(uid);
                  setHint(null);
                }}
              >
                {t.later}
              </button>
            </div>
            <div className="companion-footer">
              <button type="button" onClick={settings}>
                <Settings size={14} />
                {t.settings}
              </button>
              {hint.category === "extension" && (
                <button
                  type="button"
                  onClick={() => {
                    saveInstallPreference({
                      ...readInstallPreference(),
                      dismissed: true,
                    });
                    saveCompanionPreferences(uid, {
                      ...preferences,
                      extension: false,
                    });
                    setHint(null);
                  }}
                >
                  {t.never}
                </button>
              )}
            </div>
          </div>
        </aside>
      )}
      {pointer && (
        <div
          className="companion-pointer"
          style={{ left: pointer.x, top: pointer.y }}
          aria-hidden="true"
        >
          <JourneyCompanion mood="pointing" />
          <small>
            {target?.selector === ".color-mode-options" ? t.here : t.name}
          </small>
        </div>
      )}
    </>
  );
}

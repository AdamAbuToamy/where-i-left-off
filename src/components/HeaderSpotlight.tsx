import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { Download, Puzzle, Pause, Play, X } from "lucide-react";
import type { Language } from "../translations";
import { useDesignPreview } from "./designPreviewContext";
import {
  detectExtension,
  readInstallPreference,
  shouldOffer,
  storeUrl,
  validExtensionId,
} from "../lib/extensionInstall";
import type { ExtensionConfig } from "../lib/extensionInstall";

type InstallEvent = Event & { prompt: () => Promise<unknown> };
const words = {
  ar: {
    app: "حمّل التطبيق",
    chrome: "حمّل إضافة Chrome",
    appHint: "ثبّته على جهازك",
    chromeHint: "احفظ صفحاتك بنقرة",
    pause: "إيقاف حركة العنوان",
    play: "تشغيل حركة العنوان",
    close: "إغلاق",
    guide:
      "افتح قائمة المتصفح واختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية» إن كان الخيار متاحًا. لا يحتاج التطبيق متجرًا أو تنزيل ملف APK.",
  },
  he: {
    app: "התקינו את היישום",
    chrome: "התקינו את תוסף Chrome",
    appHint: "גישה מהירה מהמכשיר",
    chromeHint: "שמרו דפים בלחיצה",
    pause: "השהיית תנועת הכותרת",
    play: "הפעלת תנועת הכותרת",
    close: "סגירה",
    guide:
      "בתפריט הדפדפן בחרו התקנת יישום או הוספה למסך הבית, אם האפשרות זמינה. אין צורך בחנות או בקובץ APK.",
  },
  en: {
    app: "Install the app",
    chrome: "Get the Chrome extension",
    appHint: "Keep WILO on your device",
    chromeHint: "Save pages in one click",
    pause: "Pause title animation",
    play: "Resume title animation",
    close: "Close",
    guide:
      "Open your browser menu and choose Install app or Add to Home Screen when available. No app store or APK download is required.",
  },
};

const reducedQuery = "(prefers-reduced-motion: reduce)";
function subscribeReduced(changed: () => void) {
  const media = window.matchMedia?.(reducedQuery);
  media?.addEventListener("change", changed);
  return () => media?.removeEventListener("change", changed);
}
function reducedSnapshot() {
  return window.matchMedia?.(reducedQuery).matches ?? false;
}

/** Admin-only rotating sign. Never opens a permission or store page without a click. */
export default function HeaderSpotlight({
  brand,
  language,
  installed,
}: {
  brand: string;
  language: Language;
  installed: boolean;
}) {
  const { enabled } = useDesignPreview(),
    reduced = useSyncExternalStore(
      subscribeReduced,
      reducedSnapshot,
      () => true,
    );
  const t = words[language];
  const [phase, setPhase] = useState(0),
    [paused, setPaused] = useState(false),
    [hovered, setHovered] = useState(false),
    [focused, setFocused] = useState(false),
    [visible, setVisible] = useState(
      () => document.visibilityState === "visible",
    );
  const [config, setConfig] = useState<ExtensionConfig>({
      extensionId: "",
      published: false,
    }),
    [extensionInstalled, setExtensionInstalled] = useState(false),
    [guide, setGuide] = useState(false);
  const install = useRef<InstallEvent | null>(null),
    dialog = useRef<HTMLDialogElement>(null);
  const extension =
    enabled && shouldOffer(config, readInstallPreference(), extensionInstalled)
      ? storeUrl(config)
      : null;
  const faces = [
    "brand",
    ...(!installed ? ["app"] : []),
    "brand",
    ...(extension ? ["chrome"] : []),
  ];
  const face = reduced ? "brand" : faces[phase % faces.length];
  const interacting = hovered || focused;
  const promotionsAvailable = !installed || !!extension;
  useEffect(() => {
    if (!enabled) return;
    const abort = new AbortController();
    let active = true;
    void fetch("/extension-config.json", {
      cache: "no-store",
      signal: abort.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then(async (value) => {
        if (!active || !value || !validExtensionId(value.extensionId)) return;
        const next = {
          extensionId: value.extensionId,
          published: value.published === true,
        };
        setConfig(next);
        const found = await detectExtension(next.extensionId);
        if (active) setExtensionInstalled(found);
      })
      .catch(() => {});
    return () => {
      active = false;
      abort.abort();
    };
  }, [enabled]);
  useEffect(() => {
    if (!enabled) return;
    const capture = (event: Event) => {
      event.preventDefault();
      install.current = event as InstallEvent;
    };
    window.addEventListener("beforeinstallprompt", capture);
    return () => window.removeEventListener("beforeinstallprompt", capture);
  }, [enabled]);
  useEffect(() => {
    const changed = () => setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", changed);
    return () => document.removeEventListener("visibilitychange", changed);
  }, []);
  useEffect(() => {
    if (
      !enabled ||
      reduced ||
      paused ||
      interacting ||
      !visible ||
      guide ||
      !promotionsAvailable
    )
      return;
    const timer = setInterval(() => setPhase((value) => value + 1), 12000);
    return () => clearInterval(timer);
  }, [
    enabled,
    reduced,
    paused,
    interacting,
    visible,
    guide,
    promotionsAvailable,
  ]);
  useEffect(() => {
    if (guide) dialog.current?.showModal();
  }, [guide]);
  async function installApp() {
    const prompt = install.current;
    install.current = null;
    if (prompt) {
      try {
        await prompt.prompt();
        return;
      } catch {
        /* Show honest browser instructions instead. */
      }
    }
    setGuide(true);
  }
  if (!enabled) return <h1>{brand}</h1>;
  return (
    <div
      className="brand-spotlight"
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setFocused(false);
      }}
    >
      <h1 className="brand-accessible-title">{brand}</h1>
      <div className="brand-stage">
        {reduced ? (
          <div className="brand-face" data-face="brand">
            <span className="brand-name" dir="ltr" aria-hidden="true">
              {brand}
            </span>
          </div>
        ) : (
          <AnimatePresence initial={false} mode="wait">
            <motion.div
              key={face + "-" + phase}
              className="brand-face"
              data-face={face}
              initial={reduced ? false : { rotateX: -85, scale: 0.97 }}
              animate={{ rotateX: 0, scale: 1 }}
              exit={reduced ? {} : { rotateX: 85, scale: 0.97 }}
              transition={{
                duration: reduced ? 0 : 0.52,
                ease: [0.22, 0.7, 0.2, 1],
              }}
            >
              {face === "brand" ? (
                <span className="brand-name" dir="ltr" aria-hidden="true">
                  {brand}
                </span>
              ) : face === "app" ? (
                <button
                  type="button"
                  className="brand-promotion"
                  onClick={() => void installApp()}
                >
                  <Download size={25} aria-hidden="true" />
                  <span>
                    <strong>{t.app}</strong>
                    <small>{t.appHint}</small>
                  </span>
                </button>
              ) : (
                <a
                  className="brand-promotion"
                  href={extension!}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Puzzle size={25} aria-hidden="true" />
                  <span>
                    <strong>{t.chrome}</strong>
                    <small>{t.chromeHint}</small>
                  </span>
                </a>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
      {!reduced && promotionsAvailable && (
        <button
          type="button"
          className="brand-motion-toggle"
          aria-label={paused ? t.play : t.pause}
          aria-pressed={paused}
          onClick={() => setPaused(!paused)}
        >
          {paused ? (
            <Play size={14} aria-hidden="true" />
          ) : (
            <Pause size={14} aria-hidden="true" />
          )}
        </button>
      )}
      {guide &&
        createPortal(
          <dialog
            ref={dialog}
            className="brand-install-guide"
            onCancel={() => setGuide(false)}
            onClose={() => setGuide(false)}
          >
            <h2>{t.app}</h2>
            <p>{t.guide}</p>
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                dialog.current?.close();
                setGuide(false);
              }}
            >
              <X size={16} aria-hidden="true" />
              {t.close}
            </button>
          </dialog>,
          document.body,
        )}
    </div>
  );
}

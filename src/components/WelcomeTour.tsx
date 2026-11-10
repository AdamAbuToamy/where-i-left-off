import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, ArrowRight, Check, X } from "lucide-react";
import type { User } from "firebase/auth";
import type { Language } from "../translations";
import { db } from "../lib/firebase";
import { route } from "../lib/navigation";
import FocusDialog from "./FocusDialog";
import JourneyCompanion from "./JourneyCompanion";
import { journeyText } from "./journeyText";
import { journeySteps, parseJourneySession } from "./journeySession";
import type { JourneySession, JourneyStep } from "./journeySession";
import { useJourneyWorkspace } from "./useJourneyWorkspace";
import { journeyFocusRect } from "./tourGeometry";
import "./WelcomeTour.css";
const doneKey = (uid: string) => `welcome-tour:v2:${uid}`;
const journalKey = (uid: string) =>
  `welcome-journey:v1:${db?.app.options.projectId || "wilo"}/${uid}`;
function readSession(uid: string) {
  try {
    return parseJourneySession(sessionStorage.getItem(journalKey(uid)));
  } catch {
    return null;
  }
}
function initialSession(user: User): JourneySession | null {
  const resumed = readSession(user.uid);
  if (resumed) return resumed;
  try {
    if (localStorage.getItem(doneKey(user.uid))) return null;
  } catch {
    /* Optional preference. */
  }
  const created = Date.parse(user.metadata.creationTime || "");
  const query = new URLSearchParams(location.search);
  return route().page === "personal" &&
    !query.has("groupInvite") &&
    query.get("capture") !== "tab" &&
    Number.isFinite(created) &&
    Date.now() - created < 86400000
    ? { step: "welcome", ids: [] }
    : null;
}
/** A short learning-by-doing journey over the actual application, not simulated cards. */
export default function WelcomeTour({
  user,
  language,
}: {
  user: User;
  language: Language;
}) {
  const [session, setSession] = useState<JourneySession | null>(() =>
    initialSession(user),
  );
  const [ending, setEnding] = useState(false),
    [minimized, setMinimized] = useState(false),
    [busy, setBusy] = useState(false),
    [failure, setFailure] = useState(false);
  const [surfaceOpen, setSurfaceOpen] = useState(false),
    [openedCard, setOpenedCard] = useState(false);
  const [focus, setFocus] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const active = !!session,
    step = session?.step || "welcome",
    t = journeyText[language];
  const { snapshot, ready, discard } = useJourneyWorkspace(user.uid, active);
  const createdIds = session?.ids || [];
  const cards = (snapshot?.projects || []).filter((p) =>
    createdIds.includes(p.id),
  );
  const stepIndex = journeySteps.indexOf(step);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (!session) return;
    try {
      sessionStorage.setItem(journalKey(user.uid), JSON.stringify(session));
    } catch {
      /* Session still works in memory. */
    }
  }, [session, user.uid]);
  const finish = useCallback(() => {
    try {
      localStorage.setItem(doneKey(user.uid), "done");
      sessionStorage.removeItem(journalKey(user.uid));
    } catch {
      /* Session still closes. */
    }
    setSession(null);
    setEnding(false);
    setFailure(false);
    location.hash = "/personal";
  }, [user.uid]);
  const stop = () => {
    if (createdIds.length) {
      setEnding(true);
      setFailure(false);
    } else finish();
  };
  useEffect(() => {
    let observer: MutationObserver | null = null;
    const replay = () => {
      const begin = () => {
        if (
          document.querySelector(
            "dialog[open],#new-project-panel.is-open,.phone-form-fullscreen,.phone-card-fullscreen,.card-editor",
          )
        )
          return false;
        observer?.disconnect();
        setSession(readSession(user.uid) || { step: "welcome", ids: [] });
        setEnding(false);
        setMinimized(false);
        return true;
      };
      if (!begin()) {
        observer = new MutationObserver(begin);
        observer.observe(document.body, {
          subtree: true,
          childList: true,
          attributes: true,
          attributeFilter: ["open", "class"],
        });
      }
    };
    window.addEventListener("replay-welcome-tour", replay);
    return () => {
      observer?.disconnect();
      window.removeEventListener("replay-welcome-tour", replay);
    };
  }, [user.uid]);
  useEffect(() => {
    if (!active) return;
    const created = (event: Event) => {
      const detail = (event as CustomEvent<{ uid: string; id: string }>).detail;
      if (
        !detail ||
        detail.uid !== user.uid ||
        !/^[-\w]{1,100}$/.test(detail.id)
      )
        return;
      setSession((current) =>
        current && current.step === "create"
          ? {
              step: "card",
              ids: [...new Set([...current.ids, detail.id])].slice(0, 30),
            }
          : current,
      );
      setOpenedCard(false);
      setMinimized(false);
    };
    window.addEventListener("tour-project-created", created);
    return () => window.removeEventListener("tour-project-created", created);
  }, [active, user.uid]);
  useEffect(() => {
    if (!active) return;
    document.body.dataset.tourActive = "true";
    return () => {
      delete document.body.dataset.tourActive;
    };
  }, [active]);
  const targetId = createdIds[createdIds.length - 1];
  useEffect(() => {
    if (!active || step === "welcome" || step === "finish" || ending) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const editing = !!document.querySelector(
        ".phone-form-fullscreen,.phone-card-fullscreen,.desktop-card-panel,.card-editor,dialog[open]",
      );
      setSurfaceOpen(editing);
      if (
        step === "card" &&
        document.querySelector(
          `[data-project="${CSS.escape(targetId || "")}"].card-detail-panel`,
        )
      )
        setOpenedCard(true);
      const selector =
        step === "create"
          ? '[data-tour="add-project"]'
          : step === "card"
            ? `[data-project="${CSS.escape(targetId || "")}"]`
            : step === "university"
              ? ".study-toolbar,.study-dashboard-preview"
              : ".group-spaces";
      const node = document.querySelector<HTMLElement>(selector),
        rect = node?.getBoundingClientRect();
      const next = journeyFocusRect(rect || null, {
        width: innerWidth,
        height: innerHeight,
      });
      setFocus((previous) =>
        JSON.stringify(previous) === JSON.stringify(next) ? previous : next,
      );
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const observer = new MutationObserver(schedule);
    observer.observe(document.getElementById("root") || document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class", "open"],
    });
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    window.addEventListener("hashchange", schedule);
    update();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("hashchange", schedule);
    };
  }, [active, step, targetId, ending]);
  function go(next: JourneyStep) {
    setSession((current) => (current ? { ...current, step: next } : current));
    setMinimized(false);
    const path =
      next === "university"
        ? "/university"
        : next === "groups"
          ? "/groups"
          : "/personal";
    location.hash = path;
  }
  async function remove() {
    if (busy) return;
    setBusy(true);
    setFailure(false);
    try {
      await discard(createdIds);
      if (alive.current) finish();
    } catch {
      if (alive.current) setFailure(true);
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  function openCard() {
    location.hash = "/personal";
    const node = document.querySelector<HTMLElement>(
      `[data-project="${CSS.escape(targetId || "")}"] .envelope-expand`,
    );
    if (node) {
      node.click();
      setOpenedCard(true);
    }
  }
  if (!session) return null;
  const modal = step === "welcome" || step === "finish" || ending;
  const title = ending ? t.cleanup : t[step];
  const body = ending
    ? t.cleanupBody
    : step === "welcome"
      ? t.intro
      : step === "create"
        ? t.createBody
        : step === "card"
          ? t.cardBody
          : step === "university"
            ? t.universityBody
            : step === "groups"
              ? t.groupsBody
              : t.finishBody;
  const finishContent = (
    <>
      <p>{ending ? t.cleanupBody : t.finishBody}</p>
      {createdIds.length > 0 && (
        <>
          {!ending && (
            <>
              <h3>{t.cleanup}</h3>
              <p>{t.cleanupBody}</p>
            </>
          )}
          <ul className="journey-receipts">
            {cards.map((card) => (
              <li key={card.id}>
                <Check size={16} />
                <span dir="auto">{card.name}</span>
              </li>
            ))}
          </ul>
          <small>{t.saveNotice}</small>
        </>
      )}
      {!createdIds.length && <p>{t.none}</p>}
      {failure && (
        <p role="alert" className="notice error">
          {t.failure}
        </p>
      )}
      <div className="journey-actions">
        <button className="primary-button" disabled={busy} onClick={finish}>
          {createdIds.length ? t.keep : t.done}
        </button>
        {createdIds.length > 0 && (
          <button
            className="journey-remove"
            disabled={busy || !ready}
            onClick={() => void remove()}
          >
            {busy ? t.removing : t.remove}
          </button>
        )}
      </div>
      {!!createdIds.length && !ready && <p role="status">{t.sync}</p>}
    </>
  );
  return (
    <>
      <FocusDialog
        open={modal}
        title={title}
        language={language}
        onClose={() => {
          if (!busy) {
            if (ending || step === "finish") {
              setEnding(false);
              if (step === "finish") go("groups");
            } else stop();
          }
        }}
      >
        <div className="journey-welcome tour-popover" data-tour-step={step}>
          <JourneyCompanion celebrate={step === "finish"} />
          <span className="journey-eyebrow">{t.name}</span>
          {step === "welcome" && !ending ? (
            <>
              <p>{t.intro}</p>
              <small>{t.saveNotice}</small>
              <div className="journey-actions">
                <button className="primary-button" onClick={() => go("create")}>
                  {t.start}
                  <ArrowRight size={17} />
                </button>
                <button className="secondary-button guide-skip" onClick={stop}>
                  {t.skip}
                </button>
              </div>
            </>
          ) : (
            finishContent
          )}
        </div>
      </FocusDialog>
      {!modal &&
        createPortal(
          <div
            className="journey-layer"
            dir={language === "en" ? "ltr" : "rtl"}
            data-tour-step={step}
            data-surface-open={surfaceOpen}
          >
            {focus && !surfaceOpen && !minimized && (
              <div
                className="journey-target"
                style={{
                  left: focus.x,
                  top: focus.y,
                  width: focus.width,
                  height: focus.height,
                }}
                aria-hidden="true"
              />
            )}
            <aside
              className={"journey-coach" + (minimized ? " is-minimized" : "")}
              aria-label={t.name}
            >
              <header>
                <JourneyCompanion celebrate={step === "card"} />
                <div>
                  <small>
                    {t.name} · {t.step} {stepIndex}/4
                  </small>
                  <h2 aria-live="polite">{title}</h2>
                </div>
                <button
                  className="journey-minimize"
                  aria-label={minimized ? t.show : t.hide}
                  onClick={() => setMinimized((v) => !v)}
                >
                  {minimized ? (
                    <ChevronUp size={18} />
                  ) : (
                    <ChevronDown size={18} />
                  )}
                </button>
              </header>
              {!minimized && (
                <>
                  <p>{body}</p>
                  <div
                    className="journey-progress"
                    aria-label={`${stepIndex}/4`}
                  >
                    <i style={{ width: `${stepIndex * 25}%` }} />
                  </div>
                  <div className="journey-actions">
                    {step === "create" ? (
                      <>
                        <a className="secondary-button" href="#/personal">
                          {t.personal}
                        </a>
                        <small role="status">{t.waiting}</small>
                      </>
                    ) : step === "card" ? (
                      <>
                        <button className="secondary-button" onClick={openCard}>
                          {t.openCard}
                        </button>
                        <button
                          className="primary-button"
                          disabled={!openedCard}
                          onClick={() => go("university")}
                        >
                          {t.tried}
                        </button>
                      </>
                    ) : (
                      <>
                        <a
                          className="secondary-button"
                          href={
                            step === "university" ? "#/university" : "#/groups"
                          }
                        >
                          {step === "university" ? t.goUniversity : t.goGroups}
                        </a>
                        <button
                          className="primary-button"
                          onClick={() =>
                            go(step === "university" ? "groups" : "finish")
                          }
                        >
                          {t.next}
                        </button>
                      </>
                    )}
                  </div>
                  <button className="journey-stop" onClick={stop}>
                    <X size={13} />
                    {t.stop}
                  </button>
                </>
              )}
            </aside>
          </div>,
          document.body,
        )}
    </>
  );
}

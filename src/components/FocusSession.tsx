import { Pause, Play, X } from "lucide-react";
import { transcriptionWords } from "../session/transcriptionWords";
import { sessionWords } from "../session/words";
import type { SessionIdentity } from "../session/domain";
import type { SessionWorkspaceHandle } from "../session/SessionVoicePanel";
import type { SessionEntry } from "../lib/sessionJournal";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { User } from "firebase/auth";
import type { Project } from "../types";
import type { ProjectDetails } from "../lib/projects";
import type { Language } from "../translations";
import { workflowText } from "../workflowText";
import {
  queueSession,
  newSessionId,
  useSessionHistory,
} from "../lib/sessionJournal";
import {
  elapsedSeconds,
  pauseClock,
  MAX_SESSION_SECONDS,
} from "../lib/sessionClock";
import type { SessionClock } from "../lib/sessionClock";
import { logEvent } from "../lib/logging";
const SessionVoicePanel = lazy(() => import("../session/SessionVoicePanel"));
export default function FocusSession({
  project,
  user,
  groupId,
  language,
  onSave,
}: {
  project: Project;
  user: User;
  groupId?: string;
  language: Language;
  onSave: (details: ProjectDetails, revision: number) => Promise<boolean>;
}) {
  const t = workflowText[language],
    dialog = useRef<HTMLDialogElement>(null),
    clock = useRef<SessionClock | null>(null),
    [now, setNow] = useState(Date.now),
    [seconds, setSeconds] = useState(0),
    [running, setRunning] = useState(false),
    [open, setOpen] = useState(false),
    [checkpoint, setCheckpoint] = useState(project.checkpoint || ""),
    [next, setNext] = useState(project.nextStep),
    [busy, setBusy] = useState(false),
    [failed, setFailed] = useState(false),
    [saved, setSaved] = useState(false),
    [progress, setProgress] = useState(project.progressUnits || 0);
  const [activeIdentity, setActiveIdentity] = useState<SessionIdentity | null>(
    null,
  );
  const [historyLimit, setHistoryLimit] = useState(5);
  const sessionWorkspace = useRef<SessionWorkspaceHandle>(null),
    [historySession, setHistorySession] = useState<SessionEntry | null>(null);
  const draftKey = `focus-draft:${user.uid}:${groupId || "personal"}/${project.id}`,
    id = useRef(""),
    revision = useRef(project.revision),
    { items } = useSessionHistory(user.uid, open);
  const matchingHistory = items.filter(
    (s) => s.projectId === project.id && s.groupId === (groupId || ""),
  );
  useEffect(() => {
    if (!open) return;
    dialog.current?.showModal();
    const timer = window.setInterval(() => {
      const value = Date.now();
      if (
        clock.current &&
        elapsedSeconds(clock.current, value) >= MAX_SESSION_SECONDS
      ) {
        clock.current = pauseClock(clock.current, value);
        setRunning(false);
      }
      setNow(value);
      setSeconds(clock.current ? elapsedSeconds(clock.current, value) : 0);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [open]);
  useEffect(() => {
    if (!open || !clock.current) return;
    try {
      sessionStorage.setItem(
        draftKey,
        JSON.stringify({
          clock: pauseClock(clock.current, now),
          checkpoint,
          next,
          progress,
          id: id.current,
        }),
      );
    } catch {
      /* The open dialog retains its draft. */
    }
  }, [draftKey, open, checkpoint, next, progress, running, now]);
  function start() {
    const active = document.querySelector<HTMLDialogElement>(
      "dialog.focus-dialog[open]",
    );
    if (active) {
      active.focus();
      return;
    }
    setSaved(false);
    setFailed(false);
    setHistorySession(null);
    setHistoryLimit(5);
    revision.current = project.revision;
    let stored: {
      clock: SessionClock;
      checkpoint: string;
      next: string;
      progress: number;
      id: string;
    } | null = null;
    try {
      stored = JSON.parse(sessionStorage.getItem(draftKey) || "null");
    } catch {
      /* New session. */
    }
    const time = Date.now();
    clock.current = stored?.clock
      ? pauseClock(
          stored.clock,
          Math.min(time, stored.clock.runningSince || time),
        )
      : { startedAt: time, runningSince: time, accumulated: 0 };
    id.current = stored?.id || newSessionId(user.uid);
    setActiveIdentity({
      id: id.current,
      projectId: project.id,
      groupId: groupId || "",
      startedAt: clock.current.startedAt,
    });
    setCheckpoint(stored?.checkpoint ?? project.checkpoint ?? "");
    setNext(stored?.next ?? project.nextStep);
    setProgress(stored?.progress ?? project.progressUnits ?? 0);
    setNow(time);
    setSeconds(elapsedSeconds(clock.current, time));
    setRunning(clock.current.runningSince !== null);
    setOpen(true);
  }
  async function close() {
    if (busy) return;
    setBusy(true);
    try {
      await sessionWorkspace.current?.beforeFinish();
      if (clock.current) clock.current = pauseClock(clock.current);
      setRunning(false);
      dialog.current?.close();
      setOpen(false);
    } catch (error) {
      setFailed(true);
      logEvent("session.close", error);
    } finally {
      setBusy(false);
    }
  }
  async function finish() {
    if (busy || !clock.current) return;
    setBusy(true);
    setFailed(false);
    clock.current = pauseClock(clock.current);
    setRunning(false);
    try {
      await sessionWorkspace.current?.beforeFinish();
      if (
        !(await onSave(
          { checkpoint, nextStep: next, progressUnits: progress },
          revision.current,
        ))
      )
        throw new Error("save-failed");
      queueSession(user.uid, {
        id: id.current,
        projectId: project.id,
        projectName: project.name,
        groupId: groupId || "",
        resourceType: project.resourceType || "project",
        startedAt: clock.current.startedAt,
        endedAt: Date.now(),
        seconds: elapsedSeconds(clock.current),
        checkpoint,
        nextStep: next,
      });
      sessionStorage.removeItem(draftKey);
      dialog.current?.close();
      setOpen(false);
      setSaved(true);
    } catch (error) {
      setFailed(true);
      logEvent("session.finish", error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button
        type="button"
        className="card-secondary focus-launch"
        onClick={start}
      >
        {t.startSession}
      </button>
      {saved && <p role="status">{t.saved}</p>}
      {open && activeIdentity && (
        <dialog
          ref={dialog}
          className="settings-dialog focus-dialog"
          aria-labelledby={`focus-title-${project.id}`}
          onCancel={(e) => {
            e.preventDefault();
            close();
          }}
        >
          <header className="focus-session-header">
            <h2 id={`focus-title-${project.id}`}>{project.name}</h2>
            <output className="focus-timer" aria-label={t.session}>
              {String(Math.floor(seconds / 60)).padStart(2, "0")}:
              {String(seconds % 60).padStart(2, "0")}
            </output>
            <button
              type="button"
              className="secondary-button"
              disabled={busy || seconds >= MAX_SESSION_SECONDS}
              onClick={() => {
                if (!clock.current) return;
                clock.current = running
                  ? pauseClock(clock.current)
                  : { ...clock.current, runningSince: Date.now() };
                setRunning(!running);
                setNow(Date.now());
              }}
              aria-label={t.session + ": " + (running ? t.pause : t.resume)}
            >
              {running ? <Pause size={15} /> : <Play size={15} />}
            </button>
            <button
              type="button"
              className="focus-session-close"
              disabled={busy}
              onClick={() => void close()}
              aria-label={transcriptionWords[language].close}
            >
              <X size={18} />
            </button>
          </header>
          <Suspense fallback={<p role="status">…</p>}>
            {historySession ? (
              <>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setHistorySession(null)}
                >
                  {language === "ar"
                    ? "العودة إلى الجلسة الحالية"
                    : language === "he"
                      ? "חזרה למפגש הנוכחי"
                      : "Back to current session"}
                </button>
                <SessionVoicePanel
                  key={historySession.id}
                  uid={user.uid}
                  identity={{
                    id: historySession.id,
                    projectId: historySession.projectId,
                    groupId: historySession.groupId,
                    startedAt: historySession.startedAt,
                  }}
                  language={language}
                  historical
                />
              </>
            ) : (
              <SessionVoicePanel
                ref={sessionWorkspace}
                key={activeIdentity.id}
                uid={user.uid}
                identity={activeIdentity}
                language={language}
              />
            )}
          </Suspense>
          <details className="focus-checkpoint-details">
            <summary>{transcriptionWords[language].checkpoint}</summary>
            <form
              id={"focus-checkpoint-form-" + project.id}
              onSubmit={(e) => {
                e.preventDefault();
                void finish();
              }}
            >
              <label htmlFor={`focus-checkpoint-${project.id}`}>
                {t.checkpoint}
              </label>
              <textarea
                id={`focus-checkpoint-${project.id}`}
                rows={3}
                maxLength={1000}
                value={checkpoint}
                disabled={busy}
                onChange={(e) => setCheckpoint(e.target.value)}
              />
              <label htmlFor={`focus-next-${project.id}`}>{t.next}</label>
              <textarea
                id={`focus-next-${project.id}`}
                rows={2}
                maxLength={1000}
                value={next}
                disabled={busy}
                onChange={(e) => setNext(e.target.value)}
              />
              {["book", "course", "series"].includes(
                project.resourceType || "",
              ) && (
                <>
                  <label htmlFor={`focus-progress-${project.id}`}>
                    {t.progress}
                  </label>
                  <input
                    id={`focus-progress-${project.id}`}
                    type="number"
                    min={0}
                    max={project.totalUnits || 1000000}
                    value={progress}
                    disabled={busy}
                    onChange={(e) => setProgress(Number(e.target.value))}
                  />
                </>
              )}
            </form>
          </details>
          <footer className="focus-session-footer">
            {failed && <p role="alert">{t.fail}</p>}
            <button
              className="primary-button"
              type="submit"
              form={"focus-checkpoint-form-" + project.id}
              disabled={busy || !!historySession}
            >
              {busy ? "…" : transcriptionWords[language].end}
            </button>
          </footer>
          <details>
            <summary>{t.history}</summary>
            {matchingHistory.slice(0, historyLimit).map((s) => (
              <article className="session-history" key={s.id}>
                <time>{new Date(s.endedAt).toLocaleString(language)}</time>
                <p>{s.checkpoint}</p>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setHistorySession(s)}
                >
                  {sessionWords[language].history}
                </button>
                <small>
                  {Math.floor(s.seconds / 60)} {t.minutes}
                </small>
              </article>
            ))}
            {matchingHistory.length > historyLimit && (
              <button
                type="button"
                className="secondary-button"
                onClick={() => setHistoryLimit((count) => count + 5)}
              >
                {sessionWords[language].older}
              </button>
            )}
          </details>
        </dialog>
      )}
    </>
  );
}

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  Mic,
  Download,
  Square,
  LoaderCircle,
  FileText,
  StickyNote,
  ListChecks,
  Trash2,
} from "lucide-react";
import type { Language } from "../translations";
import { createClientId } from "../lib/clientId";
import { emptySession, SessionError } from "./domain";
import type {
  SessionIdentity,
  SessionState,
  SessionProposal,
  SessionOperation,
  TranscriptSegment,
} from "./domain";
import { prepareSessionProposal } from "./control";
import type { SessionControlValues } from "./control";
import { appendTranscript } from "./transcript";
import { createSessionWorkspace, activeSessionWorkspaces } from "./composition";
import type { SessionStatus } from "./repository";
import { SessionClipController } from "./clipController";
import { SessionClipDraft } from "./SessionClipDraft";
import type { SpeechEvent } from "./speechController";
import {
  speechDownloadSnapshot,
  subscribeSpeechDownload,
  refreshSpeechDownload,
  startSpeechDownload,
} from "./speechDownload";
import { BrowserSpeech } from "./browserSpeech";
import { BrowserMicrophone } from "./browserMicrophone";
import type { SpokenSegment } from "./commands";
import { sessionWords, sessionErrorText } from "./words";
import { transcriptionWords } from "./transcriptionWords";
import { SessionManualEditor } from "./SessionManualEditor";
import { TranscriptParagraph } from "./TranscriptParagraph";
import "./sessionVoice.css";
export type SessionWorkspaceHandle = { beforeFinish: () => Promise<void> };
type Props = {
  uid: string;
  identity: SessionIdentity;
  language: Language;
  historical?: boolean;
  onSaveNextStep?: (text: string) => Promise<boolean>;
};
type Tab = "transcript" | "notes" | "checklist";
const icons = {
  transcript: FileText,
  notes: StickyNote,
  checklist: ListChecks,
};
const SessionVoicePanel = forwardRef<SessionWorkspaceHandle, Props>(
  function SessionVoicePanel(
    { uid, identity, language, historical = false, onSaveNextStep },
    ref,
  ) {
    const t = transcriptionWords[language],
      legacy = sessionWords[language];
    const download = useSyncExternalStore(
      subscribeSpeechDownload,
      speechDownloadSnapshot,
    );
    useEffect(() => {
      void refreshSpeechDownload();
    }, []);
    const [repository] = useState(() => createSessionWorkspace(uid, identity));
    const [state, setState] = useState<SessionState>(() =>
      emptySession(identity),
    );
    const [status, setStatus] = useState<SessionStatus>({
      ready: false,
      pending: false,
      conflict: false,
      error: "",
    });
    const [tab, setTab] = useState<Tab>("transcript"),
      [voiceLanguage, setVoiceLanguage] = useState<Language>(language);
    const [speech, setSpeech] = useState<SpeechEvent>({
      stage: "off",
      microphone: false,
    });
    const [busy, setBusy] = useState(false),
      [finishing, setFinishing] = useState(false),
      [error, setError] = useState("");
    const [unsaved, setUnsaved] = useState<TranscriptSegment[]>([]);
    const [recordedSeconds, setRecordedSeconds] = useState(0);
    useEffect(() => {
      if (!speech.microphone) return;
      const started = Date.now();
      const timer = setInterval(
        () =>
          setRecordedSeconds(
            Math.min(24, Math.floor((Date.now() - started) / 1000)),
          ),
        250,
      );
      return () => clearInterval(timer);
    }, [speech.microphone]);
    const alive = useRef(false),
      controller = useRef<SessionClipController | null>(null),
      editing = useRef<string | null>(null),
      handled = useRef(new Set<string>()),
      pending = useRef(new Map<string, SpokenSegment>()),
      saving = useRef(0),
      nextStepSaver = useRef(onSaveNextStep);
    useEffect(() => {
      nextStepSaver.current = onSaveNextStep;
    }, [onSaveNextStep]);
    const save = useCallback(
      async (proposal: SessionProposal) => {
        saving.current++;
        if (alive.current) {
          setBusy(true);
          setError("");
        }
        try {
          await repository.apply(proposal);
          return true;
        } catch (cause) {
          if (alive.current)
            setError(
              sessionErrorText(
                cause instanceof Error ? cause.message : "session-save-failed",
                language,
              ),
            );
          return false;
        } finally {
          saving.current--;
          if (alive.current) setBusy(saving.current > 0);
        }
      },
      [repository, language],
    );
    const manual = useCallback(
      async (
        verb: SessionControlValues["verb"],
        text?: string,
        id?: string,
      ) => {
        try {
          const current = repository.current();
          return await save(
            prepareSessionProposal(
              current,
              [
                {
                  sessionId: current.id,
                  expectedRevision: current.contentRevision,
                  verb,
                  ...(text !== undefined ? { text } : {}),
                  ...(id ? { id } : {}),
                },
              ],
              "manual",
              createClientId,
              Date.now(),
            ),
          );
        } catch (cause) {
          setError(
            sessionErrorText(
              cause instanceof Error ? cause.message : "session-invalid",
              language,
            ),
          );
          return false;
        }
      },
      [repository, language, save],
    );
    const saveFinal = useCallback(
      async (
        segment: SpokenSegment,
        text = segment.text,
        target: "note" | "nextStep" = "note",
      ) => {
        if (
          !alive.current ||
          segment.sessionId !== identity.id ||
          !segment.final
        )
          return;
        if (target === "nextStep" && !(await nextStepSaver.current?.(text)))
          return false;
        const current = repository.current();
        const proposal = appendTranscript(
          current,
          { ...segment, text },
          editing.current,
          true,
        );
        if (target === "note")
          proposal.operations.push({
            verb: "add_note",
            operationId: segment.id + "-note",
            id: segment.id + "-note",
            text,
          });
        const ok = await save(proposal);
        if (ok) {
          pending.current.delete(segment.id);
          setUnsaved((old) => old.filter((item) => item.id !== segment.id));
        }
        return ok;
      },
      [repository, identity.id, save],
    );
    useEffect(() => {
      let mounted = true;
      alive.current = true;
      activeSessionWorkspaces.add(uid + "/" + identity.id);
      void repository
        .start((next, storage) => {
          if (mounted) {
            setState(next);
            setStatus(storage);
          }
        })
        .catch((cause) => {
          if (mounted)
            setError(
              sessionErrorText(
                cause instanceof Error ? cause.message : "session-save-failed",
                language,
              ),
            );
        });
      const online = () => void repository.flush();
      window.addEventListener("online", online);
      return () => {
        mounted = false;
        alive.current = false;
        repository.stop();
        activeSessionWorkspaces.delete(uid + "/" + identity.id);
        window.removeEventListener("online", online);
        window.dispatchEvent(
          new CustomEvent("wilo-session-local", {
            detail: uid + "/" + identity.id,
          }),
        );
      };
    }, [repository, uid, identity.id, language]);
    useEffect(() => {
      let mounted = true;
      const speechController = new SessionClipController({
        speech: () => new BrowserSpeech(),
        microphone: () => new BrowserMicrophone(true),
        current: () => repository.current(),
        language: voiceLanguage,
        now: Date.now,
        changed: (event) => {
          if (mounted) setSpeech(event);
        },
        final: (segment) => {
          if (
            !mounted ||
            handled.current.has(segment.id) ||
            !segment.final ||
            segment.sessionId !== identity.id
          )
            return;
          handled.current.add(segment.id);
          pending.current.set(segment.id, segment);
          setUnsaved((old) => [
            ...old,
            { id: segment.id, text: segment.text, at: segment.at },
          ]);
        },
      });
      controller.current = speechController;
      const hide = () => {
          if (document.visibilityState !== "visible")
            void speechController.finish(true);
        },
        leave = () => void speechController.stop();
      document.addEventListener("visibilitychange", hide);
      window.addEventListener("pagehide", leave);
      return () => {
        mounted = false;
        speechController.dispose();
        if (controller.current === speechController) controller.current = null;
        document.removeEventListener("visibilitychange", hide);
        window.removeEventListener("pagehide", leave);
      };
    }, [repository, voiceLanguage, identity.id, saveFinal, t.unsaved]);
    const finish = useCallback(
      async (keepModel = false) => {
        setFinishing(true);
        try {
          await controller.current?.finish(keepModel);
          if (
            !keepModel &&
            (pending.current.size || controller.current?.hasPendingAudio)
          ) {
            setError(t.reviewBeforeClose);
            throw new SessionError("session-clip-review");
          }
          if (repository.status().conflict)
            throw new SessionError("session-conflict");
          if (repository.status().ready) await repository.flush();
          if (repository.status().conflict)
            throw new SessionError("session-conflict");
        } finally {
          if (alive.current) setFinishing(false);
        }
      },
      [repository, t.reviewBeforeClose],
    );
    useImperativeHandle(ref, () => ({ beforeFinish: finish }), [finish]);
    async function start() {
      await refreshSpeechDownload();
      if (speechDownloadSnapshot().stage !== "ready") return;
      setError("");
      setTab("transcript");
      const current = repository.current();
      if (!current.retainTranscript) {
        const ok = await save({
          sessionId: current.id,
          baseRevision: current.contentRevision,
          origin: "manual",
          operations: [
            {
              verb: "retain_transcript",
              operationId: createClientId(),
              enabled: true,
            },
          ],
        });
        if (!ok) return;
      }
      setRecordedSeconds(0);
      await controller.current?.start();
    }
    async function correct(id: string, text: string, original: string) {
      const current = repository.current();
      const operation: SessionOperation = text.trim()
        ? {
            verb: "edit_transcript",
            id,
            text,
            sourceText: original,
            operationId: createClientId(),
          }
        : {
            verb: "delete_transcript",
            id,
            sourceText: original,
            operationId: createClientId(),
          };
      return save({
        sessionId: current.id,
        baseRevision: current.contentRevision,
        origin: "manual",
        operations: [operation],
      });
    }
    async function clear() {
      if (!window.confirm(t.confirmClear)) return;
      await finish();
      const current = repository.current();
      await save({
        sessionId: current.id,
        baseRevision: current.contentRevision,
        origin: "manual",
        operations: [
          {
            verb: "retain_transcript",
            enabled: false,
            operationId: createClientId(),
          },
        ],
      });
    }
    async function resolve(choice: "local" | "remote") {
      try {
        await repository.resolve(choice);
      } catch (cause) {
        setError(
          sessionErrorText(
            cause instanceof Error ? cause.message : "session-save-failed",
            language,
          ),
        );
      }
    }
    const disabled = !status.ready || status.conflict || busy || finishing;
    const active = ["loading", "listening", "processing"].includes(
      speech.stage,
    );
    const phase = finishing
      ? t.finishing
      : speech.stage === "error"
        ? sessionErrorText(speech.error || "speech-error", language)
        : t[speech.stage];
    const tabs: Tab[] = ["transcript", "notes", "checklist"];
    const sync = status.ready
      ? status.pending
        ? t.local
        : state.applied.length
          ? t.synced
          : legacy.connected
      : legacy.ready;
    return (
      <section
        className="session-workspace session-transcription"
        aria-busy={busy}
        dir={language === "en" ? "ltr" : "rtl"}
        aria-label={t.title}
      >
        <header className="session-workspace-heading">
          <div className="session-tabs" role="tablist" aria-label={t.title}>
            {tabs.map((value) => {
              const Icon = icons[value],
                count =
                  value === "notes"
                    ? state.notes.length
                    : value === "checklist"
                      ? state.items.length
                      : 0;
              return (
                <button
                  type="button"
                  role="tab"
                  key={value}
                  id={identity.id + "-tab-" + value}
                  aria-controls={identity.id + "-panel-" + value}
                  aria-selected={tab === value}
                  tabIndex={tab === value ? 0 : -1}
                  onClick={() => setTab(value)}
                  onKeyDown={(event) => {
                    if (
                      !["ArrowRight", "ArrowLeft", "Home", "End"].includes(
                        event.key,
                      )
                    )
                      return;
                    event.preventDefault();
                    const index = tabs.indexOf(value),
                      next =
                        event.key === "Home"
                          ? tabs[0]
                          : event.key === "End"
                            ? tabs[2]
                            : tabs[
                                (index +
                                  ((
                                    language === "en"
                                      ? event.key === "ArrowRight"
                                      : event.key === "ArrowLeft"
                                  )
                                    ? 1
                                    : 2)) %
                                  3
                              ];
                    setTab(next);
                    document
                      .getElementById(identity.id + "-tab-" + next)
                      ?.focus();
                  }}
                >
                  <Icon size={16} />
                  {t[value]}
                  {count > 0 && <small>{count}</small>}
                </button>
              );
            })}
          </div>
          <small
            role="status"
            data-session-sync={
              status.conflict
                ? "conflict"
                : status.pending
                  ? "pending"
                  : status.ready
                    ? "ready"
                    : "loading"
            }
          >
            {sync}
          </small>
        </header>
        {(error || status.error) && (
          <p role="alert" className="session-error">
            {error || sessionErrorText(status.error, language)}
            {status.error && (
              <small className="session-error-code" dir="ltr">
                {status.error}
              </small>
            )}
            {status.error && (
              <button type="button" onClick={() => void repository.flush()}>
                {t.retry}
              </button>
            )}
          </p>
        )}
        {status.conflict && (
          <aside className="session-conflict">
            <p>{t.conflict}</p>
            <button type="button" onClick={() => void resolve("local")}>
              {t.keepLocal}
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm(t.confirmRemote)) void resolve("remote");
              }}
            >
              {t.keepRemote}
            </button>
          </aside>
        )}
        <div
          role="tabpanel"
          id={identity.id + "-panel-transcript"}
          aria-labelledby={identity.id + "-tab-transcript"}
          hidden={tab !== "transcript"}
        >
          {!historical && (
            <>
              <div
                className="session-record-bar"
                data-recording={speech.microphone ? "true" : "false"}
                data-working={
                  speech.stage === "loading" || finishing ? "true" : "false"
                }
              >
                <button
                  type="button"
                  className={
                    download.stage === "ready"
                      ? "primary-button session-clip-record"
                      : "primary-button"
                  }
                  aria-label={
                    download.stage === "ready"
                      ? speech.microphone
                        ? t.stopClip
                        : speech.stage === "error"
                          ? t.retry
                          : t.recordClip
                      : undefined
                  }
                  title={
                    download.stage === "ready"
                      ? speech.microphone
                        ? t.stopClip
                        : t.recordClip
                      : undefined
                  }
                  disabled={
                    disabled ||
                    (active && !speech.microphone) ||
                    download.stage === "checking" ||
                    download.stage === "downloading" ||
                    download.stage === "saving"
                  }
                  onClick={() => {
                    if (active)
                      void finish(true).catch(() => setError(t.unsaved));
                    else if (download.stage !== "ready")
                      void startSpeechDownload();
                    else if (speech.stage === "error" && controller.current?.hasPendingAudio) void finish(true);
                    else void start();
                  }}
                >
                  {active && !speech.microphone ? (
                    <LoaderCircle className="session-clip-spinner" size={22} />
                  ) : active ? (
                    <Square size={20} fill="currentColor" />
                  ) : download.stage === "ready" ? (
                    <Mic size={17} />
                  ) : (
                    <Download size={17} />
                  )}{" "}
                  {download.stage !== "ready" &&
                    (download.stage === "saving"
                      ? t.savingModel
                      : download.stage === "downloading"
                        ? t.downloading
                        : download.loaded > 0
                          ? t.resumeDownload
                          : t.download)}
                </button>
                <select
                  aria-label={t.language}
                  value={voiceLanguage}
                  disabled={active || finishing || speech.stage === "error"}
                  onChange={(event) =>
                    setVoiceLanguage(event.target.value as Language)
                  }
                >
                  <option value="ar">العربية</option>
                  <option value="he">עברית</option>
                  <option value="en">English</option>
                </select>
                <span
                  className="session-record-state"
                  role="status"
                  data-microphone={speech.microphone ? "active" : "off"}
                >
                  <span className="session-voice-wave" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                  </span>
                  {phase}
                  {speech.microphone && (
                    <time className="session-clip-time" dir="ltr">
                      00:{String(recordedSeconds).padStart(2, "0")} / 00:24
                    </time>
                  )}
                </span>
              </div>
              {(download.stage === "downloading" ||
                download.stage === "saving") && (
                <div className="session-download" role="status">
                  <Download
                    className="session-download-icon"
                    size={22}
                    aria-hidden="true"
                  />
                  <progress
                    aria-label={t.downloading}
                    max={download.total}
                    value={download.loaded}
                  />
                  <small>
                    {Math.floor((download.loaded / download.total) * 100)}% ·{" "}
                    {download.background
                      ? t.backgroundDownload
                      : t.foregroundDownload}
                  </small>
                </div>
              )}
              {download.stage === "error" && (
                <p className="session-error" role="alert">
                  {download.error &&
                  ["speech-gpu-required", "speech-cache"].includes(
                    download.error,
                  )
                    ? sessionErrorText(download.error, language)
                    : t.downloadError}
                </p>
              )}
              {(speech.stage === "error" || speech.stage === "processing") && (
                <button
                  type="button"
                  className="session-quiet-button"
                  onClick={() => {
                    void controller.current?.stop();
                    setError("");
                  }}
                >
                  {t.discardClip}
                </button>
              )}
              <small className="session-clip-hint">
                {speech.microphone
                  ? t.clipRecording
                  : speech.stage === "processing"
                    ? t.processingClip
                    : t.clipHint}
              </small>
              {(speech.stage === "loading" || speech.stage === "processing") &&
                speech.progress && (
                  <progress
                    aria-label={t.loading}
                    max={speech.progress.total}
                    value={speech.progress.loaded}
                  />
                )}
              <small className="session-transcription-privacy">
                {t.privacy} {download.stage !== "ready" && t.modelDownload}
              </small>
            </>
          )}
          <div className="session-conversation" aria-live="off">
            {!state.transcripts.length &&
              !unsaved.length &&
              !speech.partial && (
                <p className="session-transcript-empty">{t.empty}</p>
              )}
            {state.transcripts.map((segment, index) => (
              <TranscriptParagraph
                key={segment.id}
                segment={segment}
                label={t.part + " " + (index + 1)}
                disabled={!status.ready || status.conflict}
                onEditing={(id) => {
                  editing.current = id;
                }}
                onCorrect={correct}
              />
            ))}
            {unsaved.map((segment) => (
              <SessionClipDraft
                key={segment.id}
                segment={segment}
                language={language}
                disabled={disabled || active}
                nextStepAvailable={!!onSaveNextStep}
                onApprove={async (text, target) => {
                  const original = pending.current.get(segment.id);
                  return original
                    ? !!(await saveFinal(original, text, target))
                    : false;
                }}
                onDiscard={() => {
                  pending.current.delete(segment.id);
                  setUnsaved((old) =>
                    old.filter((item) => item.id !== segment.id),
                  );
                  setError("");
                }}
              />
            ))}
            {speech.partial && (
              <p className="session-partial" dir="auto">
                {speech.partial}
              </p>
            )}
          </div>
          <footer className="session-transcript-footer">
            {!!state.transcripts.length && (
              <button
                type="button"
                className="session-quiet-button"
                disabled={disabled || active || unsaved.length > 0}
                onClick={() => void clear().catch(() => setError(t.unsaved))}
              >
                <Trash2 size={14} />
                {t.clear}
              </button>
            )}
          </footer>
        </div>
        <div
          role="tabpanel"
          id={identity.id + "-panel-notes"}
          aria-labelledby={identity.id + "-tab-notes"}
          hidden={tab !== "notes"}
        >
          <div hidden={tab !== "notes"}>
            <SessionManualEditor
              state={state}
              disabled={disabled}
              language={language}
              view="notes"
              onAction={manual}
            />
          </div>
        </div>
        <div
          role="tabpanel"
          id={identity.id + "-panel-checklist"}
          aria-labelledby={identity.id + "-tab-checklist"}
          hidden={tab !== "checklist"}
        >
          <SessionManualEditor
            state={state}
            disabled={disabled}
            language={language}
            view="checklist"
            onAction={manual}
          />
        </div>
      </section>
    );
  },
);
export default SessionVoicePanel;

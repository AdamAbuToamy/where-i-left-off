import { SessionProposalSummary } from "./SessionProposalSummary";
import { sessionReviewRows } from "./sessionReview";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Mic, Pause, Square, Undo2 } from "lucide-react";
import type { Language } from "../translations";
import { createClientId } from "../lib/clientId";
import { planAssistantSessionOperations } from "../assistant/actions";
import { emptySession, SessionError } from "./domain";
import type {
  SessionIdentity,
  SessionState,
  SessionProposal,
  SessionOperation,
  SessionNote,
} from "./domain";
import { prepareSessionProposal } from "./control";
import type { SessionControlValues } from "./control";
import { understandSessionSpeech, sessionTextKey } from "./commands";
import type { SpokenSegment, SessionUnderstanding } from "./commands";
import { createSessionWorkspace, activeSessionWorkspaces } from "./composition";
import type { SessionStatus } from "./repository";
import { sessionAssistantBridge } from "./assistantBridge";
import { SessionSpeechController } from "./speechController";
import { BrowserSpeech } from "./browserSpeech";
import { BrowserMicrophone } from "./browserMicrophone";
import type { SpeechEvent } from "./speechController";
import { sessionWords, sessionErrorText } from "./words";
import { SessionManualEditor } from "./SessionManualEditor";
import "./sessionVoice.css";
export type SessionWorkspaceHandle = { beforeFinish: () => Promise<void> };
type Props = {
  uid: string;
  identity: SessionIdentity;
  language: Language;
  historical?: boolean;
};
type Draft = {
  id: string;
  text: string;
  original: string;
  category: SessionNote["category"];
  segmentId: string;
};
type Pending = { number: number; proposal: SessionProposal; label: string };

const SessionVoicePanel = forwardRef<SessionWorkspaceHandle, Props>(
  function SessionVoicePanel(
    { uid, identity, language, historical = false },
    ref,
  ) {
    const t = sessionWords[language];
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
    const [speech, setSpeech] = useState<SpeechEvent>({
      stage: "off",
      microphone: false,
    });
    const [voiceLanguage, setVoiceLanguage] = useState<Language>(language),
      [automatic, setAutomatic] = useState(false),
      [sharing, setSharing] = useState(false);
    const [transcript, setTranscript] = useState(""),
      [message, setMessage] = useState(""),
      [error, setError] = useState(""),
      [busy, setBusy] = useState(false);
    const [pending, setPending] = useState<Pending | null>(null),
      [understanding, setUnderstanding] = useState<SessionUnderstanding | null>(
        null,
      ),
      [drafts, setDrafts] = useState<Draft[]>([]);
    const mounted = useRef(false),
      speechController = useRef<SessionSpeechController | null>(null),
      preferences = useRef({ automatic: false, sharing: false }),
      pendingRef = useRef<Pending | null>(null),
      proposalNumber = useRef(0),
      handled = useRef(new Set<string>()),
      saving = useRef(0);
    const setProposal = useCallback((value: Pending | null) => {
      pendingRef.current = value;
      setPending(value);
    }, []);
    const save = useCallback(
      async (proposal: SessionProposal) => {
        saving.current++;
        if (mounted.current) {
          setBusy(true);
          setError("");
          setMessage("");
        }
        try {
          await repository.apply(proposal);
          if (mounted.current) {
            setMessage(sessionWords[language].saved);
            setProposal(null);
          }
          return true;
        } catch (cause) {
          if (mounted.current)
            setError(
              sessionErrorText(
                cause instanceof Error ? cause.message : "session-save-failed",
                language,
              ),
            );
          return false;
        } finally {
          saving.current--;
          if (mounted.current) setBusy(saving.current > 0);
        }
      },
      [repository, language, setProposal],
    );
    const manual = useCallback(
      async (
        verb: SessionControlValues["verb"],
        text?: string,
        id?: string,
      ) => {
        try {
          const current = repository.current(),
            proposal = prepareSessionProposal(
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
            );
          return await save(proposal);
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
      [repository, save, language],
    );
    const analyze = useCallback(
      (segment: SpokenSegment) => {
        const current = repository.current(),
          result = understandSessionSpeech(segment, current);
        setUnderstanding(result);
        setProposal(null);
        setError("");
        setMessage("");
        if (result.kind === "command") {
          try {
            const proposal = prepareSessionProposal(
              current,
              [result.values],
              "voice",
              createClientId,
              Date.now(),
            );
            for (const operation of proposal.operations)
              if (operation.verb === "add_note") {
                operation.segmentId = segment.id;
                if (current.retainTranscript)
                  operation.sourceText = segment.text;
              }
            planAssistantSessionOperations(current, proposal, Date.now());
            setProposal({
              number: ++proposalNumber.current,
              proposal,
              label: segment.text,
            });
          } catch (cause) {
            setError(
              sessionErrorText(
                cause instanceof Error ? cause.message : "session-invalid",
                language,
              ),
            );
          }
        } else if (result.kind === "speech") {
          if (preferences.current.automatic) {
            const key = sessionTextKey(result.text);
            if (
              key &&
              !current.notes.some((note) => sessionTextKey(note.text) === key)
            )
              setDrafts((old) =>
                old.some((draft) => sessionTextKey(draft.text) === key)
                  ? old
                  : old.length >= 10
                    ? old
                    : [
                        ...old,
                        {
                          id: createClientId(),
                          text: result.text,
                          original: segment.text,
                          category: result.category,
                          segmentId: segment.id,
                        },
                      ],
              );
          }
        }
      },
      [repository, language, setProposal],
    );
    useEffect(() => {
      let alive = true;
      mounted.current = true;
      activeSessionWorkspaces.add(uid + "/" + identity.id);
      const detach = sessionAssistantBridge(uid).attach(
        repository,
        () => preferences.current.sharing,
      );
      void repository
        .start((next, nextStatus) => {
          if (alive) {
            setState(next);
            setStatus(nextStatus);
          }
        })
        .catch((cause) => {
          if (alive)
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
        alive = false;
        mounted.current = false;
        repository.stop();
        detach();
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
      let alive = true;
      let chain: Promise<unknown> = Promise.resolve();
      const controller = new SessionSpeechController({
        speech: () => new BrowserSpeech(),
        microphone: () => new BrowserMicrophone(),
        current: () => repository.current(),
        language: voiceLanguage,
        now: Date.now,
        changed: (event) => {
          if (alive) setSpeech(event);
        },
        final: (segment) => {
          chain = chain
            .then(async () => {
              if (!alive || historical || handled.current.has(segment.id))
                return;
              handled.current.add(segment.id);
              setTranscript(segment.text);
              const current = repository.current(),
                result = understandSessionSpeech(segment, current);
              if (result.kind === "confirm") {
                const proposal = pendingRef.current;
                if (
                  !proposal ||
                  proposal.number !== result.number ||
                  proposal.proposal.sessionId !== current.id ||
                  proposal.proposal.baseRevision !== current.contentRevision
                ) {
                  setError(t.confirmNumber);
                  return;
                }
                await save(proposal.proposal);
              }
              if (current.retainTranscript) {
                const latest = repository.current();
                const retained = await save({
                  sessionId: latest.id,
                  baseRevision: latest.contentRevision,
                  origin: "manual",
                  operations: [
                    {
                      verb: "transcript",
                      operationId: segment.id + "-keep",
                      id: segment.id,
                      text: segment.text,
                    },
                  ],
                });
                if (!retained) {
                  await speechController.current?.pause("session-save-failed");
                  return;
                }
              }
              if (!alive || result.kind === "confirm") return;
              analyze(segment);
            })
            .catch((cause) => {
              if (alive)
                setError(
                  sessionErrorText(
                    cause instanceof Error
                      ? cause.message
                      : "session-save-failed",
                    language,
                  ),
                );
            });
        },
      });
      speechController.current = controller;
      const hide = () => {
          if (document.visibilityState !== "visible") void controller.pause();
        },
        leave = () => void controller.stop();
      document.addEventListener("visibilitychange", hide);
      window.addEventListener("pagehide", leave);
      return () => {
        alive = false;
        controller.dispose();
        if (speechController.current === controller)
          speechController.current = null;
        document.removeEventListener("visibilitychange", hide);
        window.removeEventListener("pagehide", leave);
      };
    }, [
      repository,
      voiceLanguage,
      language,
      historical,
      analyze,
      save,
      t.confirmNumber,
    ]);
    useImperativeHandle(
      ref,
      () => ({
        beforeFinish: async () => {
          await speechController.current?.stop();
          const current = repository.status();
          if (current.conflict) throw new SessionError("session-conflict");
          if (current.ready) await repository.flush();
          if (repository.status().conflict)
            throw new SessionError("session-conflict");
        },
      }),
      [repository],
    );
    const finalSegment = (text: string): SpokenSegment => {
      const current = repository.current();
      return {
        id: createClientId(),
        sequence: 0,
        text,
        at: Date.now(),
        final: true,
        sessionId: current.id,
        revision: current.contentRevision,
        order: current.items.map((item) => item.id),
      };
    };
    async function retention(enabled: boolean) {
      const current = repository.current();
      await save({
        sessionId: current.id,
        baseRevision: current.contentRevision,
        origin: "manual",
        operations: [
          { operationId: createClientId(), verb: "retain_transcript", enabled },
        ],
      });
    }
    async function acceptDraft(draft: Draft) {
      const current = repository.current(),
        operation: SessionOperation = {
          operationId: draft.id + "-accept",
          verb: "add_note",
          id: draft.id,
          text: draft.text,
          category: draft.category,
          segmentId: draft.segmentId,
          ...(current.retainTranscript ? { sourceText: draft.original } : {}),
        };
      if (
        await save({
          sessionId: current.id,
          baseRevision: current.contentRevision,
          origin: "voice",
          operations: [operation],
        })
      )
        setDrafts((old) => old.filter((item) => item.id !== draft.id));
    }
    function proposeAsNote() {
      const segment = finalSegment(transcript);
      try {
        const current = repository.current(),
          proposal = prepareSessionProposal(
            current,
            [
              {
                sessionId: current.id,
                expectedRevision: current.contentRevision,
                verb: "add_note",
                text: transcript,
              },
            ],
            "voice",
            createClientId,
            Date.now(),
          );
        proposal.operations[0].segmentId = segment.id;
        if (current.retainTranscript)
          proposal.operations[0].sourceText = transcript;
        setProposal({
          number: ++proposalNumber.current,
          proposal,
          label: transcript,
        });
      } catch (cause) {
        setError(
          sessionErrorText(
            cause instanceof Error ? cause.message : "session-invalid",
            language,
          ),
        );
      }
    }
    async function resolveConflict(choice: "local" | "remote") {
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
    const disabled = !status.ready || status.conflict || busy;
    const canUndo = state.lastVoice?.revision === state.contentRevision;
    const active =
      speech.stage === "loading" ||
      speech.stage === "listening" ||
      speech.stage === "processing";
    const stageLabel =
      speech.stage === "error"
        ? sessionErrorText(speech.error || "speech-error", language)
        : t[speech.stage];
    return (
      <section
        className="session-workspace"
        dir={language === "en" ? "ltr" : "rtl"}
        aria-label={t.title}
      >
        <header className="session-workspace-heading">
          <h3>
            <Mic size={19} />
            {historical ? t.history : t.title}
          </h3>
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
            {status.ready
              ? status.pending
                ? t.local
                : state.applied.length
                  ? t.synced
                  : t.connected
              : t.ready}
          </small>
        </header>
        {(error || status.error) && (
          <p className="session-error" role="alert">
            {error || sessionErrorText(status.error, language)}
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
            <button type="button" onClick={() => void resolveConflict("local")}>
              {t.keepLocal}
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm(t.confirmRemote))
                  void resolveConflict("remote");
              }}
            >
              {t.keepRemote}
            </button>
          </aside>
        )}
        {!historical && (
          <>
            <div className="session-voice-toolbar">
              <button
                type="button"
                className="primary-button"
                disabled={disabled || active}
                onClick={() => void speechController.current?.start()}
              >
                <Mic size={16} />
                {t.start}
              </button>
              <button
                type="button"
                className="secondary-button"
                disabled={!active}
                onClick={() => void speechController.current?.pause()}
              >
                <Pause size={16} />
                {t.pause}
              </button>
              <button
                type="button"
                className="secondary-button"
                disabled={speech.stage === "off"}
                onClick={() => void speechController.current?.stop()}
              >
                <Square size={15} />
                {t.stop}
              </button>
            </div>
            <div
              className="session-mic-state"
              data-microphone={speech.microphone ? "active" : "off"}
              role="status"
            >
              <i aria-hidden="true" />
              {speech.microphone ? t.microphone + " · " : ""}
              {stageLabel}
            </div>
            {speech.progress && speech.stage === "loading" && (
              <progress
                aria-label={t.loading}
                max={speech.progress.total}
                value={speech.progress.loaded}
              />
            )}
            <label className="session-language">
              {t.language}
              <select
                value={voiceLanguage}
                disabled={active}
                onChange={(event) =>
                  setVoiceLanguage(event.target.value as Language)
                }
              >
                <option value="ar">العربية</option>
                <option value="he">עברית</option>
                <option value="en">English</option>
              </select>
            </label>
            <p className="session-accuracy-hint">{t.speakClear}</p>
            <details className="session-privacy">
              <summary>{t.privacy}</summary>
              <p>{t.private}</p>

              <p>{t.retentionHint}</p>
              <p>{t.sharingHint}</p>
            </details>
            <div className="session-options">
              <label>
                <input
                  type="checkbox"
                  checked={automatic}
                  onChange={(event) => {
                    preferences.current.automatic = event.target.checked;
                    setAutomatic(event.target.checked);
                  }}
                />
                {t.automatic}
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={state.retainTranscript}
                  disabled={disabled}
                  onChange={(event) => void retention(event.target.checked)}
                />
                {t.retention}
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={sharing}
                  disabled={!status.ready}
                  onChange={(event) => {
                    preferences.current.sharing = event.target.checked;
                    setSharing(event.target.checked);
                  }}
                />
                {t.sharing}
              </label>
            </div>
            {speech.partial && (
              <p className="session-partial" aria-label={t.partial} dir="auto">
                {speech.partial}
              </p>
            )}
            <label htmlFor={"session-transcript-" + identity.id}>
              {t.transcript}
            </label>
            <textarea
              id={"session-transcript-" + identity.id}
              rows={2}
              maxLength={1000}
              value={transcript}
              onChange={(event) => {
                setTranscript(event.target.value);
                setProposal(null);
                setUnderstanding(null);
              }}
            />
            <div className="session-inline-actions">
              <button
                type="button"
                disabled={disabled || !transcript.trim()}
                onClick={() => analyze(finalSegment(transcript))}
              >
                {t.analyze}
              </button>
              <button
                type="button"
                disabled={disabled || !transcript.trim()}
                onClick={proposeAsNote}
              >
                {t.asNote}
              </button>
              <button
                type="button"
                disabled={disabled || !canUndo}
                onClick={() => {
                  const current = repository.current();
                  void save({
                    sessionId: current.id,
                    baseRevision: current.contentRevision,
                    origin: "voice",
                    operations: [
                      { operationId: createClientId(), verb: "undo" },
                    ],
                  });
                }}
              >
                <Undo2 size={15} />
                {t.undo}
              </button>
            </div>
            {understanding?.kind === "stale" && <p role="status">{t.stale}</p>}
            {understanding?.kind === "speech" && (
              <p role="status">{t.speechOnly}</p>
            )}
            {understanding?.kind === "remaining" && (
              <div role="status">
                <strong>{t.remaining}</strong>
                {understanding.items.length ? (
                  <ul>
                    {understanding.items.map((item) => (
                      <li key={item.id} dir="auto">
                        {item.text}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>{t.none}</p>
                )}
              </div>
            )}
            {understanding?.kind === "ambiguous" && (
              <div className="session-clarification">
                <p>{understanding.choices.length ? t.ambiguous : t.missing}</p>
                {understanding.choices.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => {
                      const current = repository.current();
                      try {
                        const proposal = prepareSessionProposal(
                          current,
                          [
                            {
                              sessionId: current.id,
                              expectedRevision: current.contentRevision,
                              verb: understanding.verb,
                              id: item.id,
                              ...(understanding.text
                                ? { text: understanding.text }
                                : {}),
                            },
                          ],
                          "voice",
                          createClientId,
                          Date.now(),
                        );
                        setProposal({
                          number: ++proposalNumber.current,
                          proposal,
                          label: item.text,
                        });
                        setUnderstanding(null);
                      } catch (cause) {
                        setError(
                          sessionErrorText(
                            cause instanceof Error
                              ? cause.message
                              : "session-invalid",
                            language,
                          ),
                        );
                      }
                    }}
                  >
                    {item.text}
                  </button>
                ))}
              </div>
            )}
            {pending && (
              <section className="session-proposal" aria-label={t.proposal}>
                <strong>
                  {t.proposal} {pending.number}
                </strong>
                {pending.proposal.baseRevision !== state.contentRevision && (
                  <p role="status">{t.stale}</p>
                )}
                <p dir="auto">{pending.label}</p>
                <SessionProposalSummary
                  rows={sessionReviewRows(state, pending.proposal)}
                  language={language}
                />
                <small>
                  {t.voiceConfirm} {pending.number}
                </small>
                <div>
                  <button
                    type="button"
                    className="primary-button"
                    disabled={
                      disabled ||
                      pending.proposal.baseRevision !== state.contentRevision
                    }
                    onClick={() => void save(pending.proposal)}
                  >
                    {t.apply}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setProposal(null);
                      setUnderstanding(null);
                    }}
                  >
                    {t.cancel}
                  </button>
                </div>
              </section>
            )}
            {!!drafts.length && (
              <section className="session-note-drafts">
                <h4>{t.drafts}</h4>
                {drafts.length >= 10 && <p role="status">{t.draftLimit}</p>}
                {drafts.map((draft) => (
                  <article key={draft.id}>
                    <textarea
                      aria-label={t.note}
                      value={draft.text}
                      maxLength={1000}
                      dir="auto"
                      onChange={(event) =>
                        setDrafts((old) =>
                          old.map((item) =>
                            item.id === draft.id
                              ? { ...item, text: event.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                    <button
                      type="button"
                      disabled={disabled || !draft.text.trim()}
                      onClick={() => void acceptDraft(draft)}
                    >
                      {t.accept}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setDrafts((old) =>
                          old.filter((item) => item.id !== draft.id),
                        )
                      }
                    >
                      {t.reject}
                    </button>
                  </article>
                ))}
              </section>
            )}
          </>
        )}
        {message && (
          <p className="session-success" role="status">
            {message} · {status.pending ? t.local : t.synced}
          </p>
        )}
        <SessionManualEditor
          state={state}
          disabled={disabled}
          language={language}
          onAction={manual}
        />
        {state.retainTranscript && !!state.transcripts.length && (
          <details className="session-retained">
            <summary>
              {t.retention} ({state.transcripts.length})
            </summary>
            {state.transcripts.map((segment) => (
              <p key={segment.id} dir="auto">
                {segment.text}
              </p>
            ))}
          </details>
        )}
      </section>
    );
  },
);
export default SessionVoicePanel;

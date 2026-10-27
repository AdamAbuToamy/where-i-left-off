import ChangeDetails from "./ChangeDetails";
import { studioValue } from "./formatting";
import { downloadStudioFile } from "../adapters/download";
import { friendlyFailure } from "../../assistant/friendlyFailure";
import { AssistantFailure } from "../../assistant/failure";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  Check,
  Copy,
  Download,
  LoaderCircle,
  MessageSquarePlus,
  Plug,
  Square,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { createClientId } from "../../lib/clientId";
import AssistantRichText from "../../assistant/AssistantRichText";
import { downloadAssistantFile } from "../../assistant/pdfExport";
import {
  connectStudioPollinations as connectPollinations,
  disconnectStudioPollinations as disconnectPollinations,
  studioPollinationsConnected as pollinationsConnected,
} from "../adapters/credentials";
import { parseControls } from "../../assistant/controlContract";
import type { Change } from "../../assistant/actions";
import type {
  StudioAssistantPort,
  StudioMessage,
  StudioThread,
} from "../adapters/assistant";
import { readStudioThreads, saveStudioThreads } from "../adapters/assistant";
import { useStudio } from "./context";
import { navigateStudio } from "./navigation";
import type { StudioWord } from "./copy";

function changeName(change: Change): string {
  const value = (change.after || change.before) as {
    name?: string;
    title?: string;
    room?: string;
  } | null;
  return value?.name || value?.title || value?.room || change.id;
}
export default function StudioAssistantPanel({
  service,
  storageKey,
  close,
  initialPrompt,
}: {
  service: StudioAssistantPort;
  storageKey: string;
  close: () => void;
  initialPrompt: string;
}) {
  const { state, route, t, run, journal, notify, uid } = useStudio();
  const [loaded] = useState(() => {
    try {
      return { threads: readStudioThreads(storageKey), failed: false };
    } catch {
      return { threads: [] as StudioThread[], failed: true };
    }
  });
  const [chatBroken, setChatBroken] = useState(loaded.failed);
  const [threads, setThreads] = useState(loaded.threads),
    [active, setActive] = useState(loaded.threads[0]?.id || ""),
    [input, setInput] = useState(initialPrompt),
    [connected, setConnected] = useState(() => pollinationsConnected(uid)),
    [busy, setBusy] = useState(false),
    [phase, setPhase] = useState("thinking"),
    [showChats, setShowChats] = useState(false);
  const threadState = useRef(loaded.threads);
  const controller = useRef<AbortController | null>(null),
    generation = useRef(0),
    lock = useRef(false),
    messagesRef = useRef<HTMLDivElement>(null),
    panelRef = useRef<HTMLElement>(null);
  const thread = threads.find((item) => item.id === active),
    turns = thread?.messages || [];
  const context =
    state.data.study.courses.find((c) => c.id === route.course)?.name ||
    state.data.scopes
      .find((s) => s.id === route.scope)
      ?.projects.find((p) => p.id === route.item)?.name ||
    t(route.screen);
  useEffect(() => {
    const requestMarker = generation;
    const previous = document.activeElement;
    panelRef.current?.querySelector<HTMLTextAreaElement>("textarea")?.focus();
    return () => {
      requestMarker.current++;
      controller.current?.abort();
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, []);
  useEffect(() => {
    messagesRef.current?.scrollTo?.({
      top: messagesRef.current.scrollHeight,
      behavior: "instant",
    });
  }, [threads, phase]);
  function persist(next: StudioThread[]) {
    if (chatBroken) {
      notify(t("failed"));
      return false;
    }
    try {
      saveStudioThreads(storageKey, next);
      threadState.current = next;
      setThreads(next);
      return true;
    } catch {
      notify(t("storageFull"));
      return false;
    }
  }
  function update(
    id: string,
    change: (messages: StudioMessage[]) => StudioMessage[],
  ) {
    persist(
      threadState.current.map((item) =>
        item.id === id
          ? { ...item, messages: change(item.messages), updatedAt: Date.now() }
          : item,
      ),
    );
  }
  function stop() {
    if (lock.current && thread)
      update(thread.id, (old) => [
        ...old.map((message, index) =>
          index === old.length - 1 && message.role === "user"
            ? { ...message, failed: true }
            : message,
        ),
        {
          id: createClientId(),
          role: "assistant",
          text: t("stopped"),
          resolved: true,
          failed: true,
        },
      ]);
    controller.current?.abort();
    generation.current++;
    lock.current = false;
    setBusy(false);
    setPhase("thinking");
  }
  async function send() {
    if (!input.trim() || lock.current || !connected || chatBroken) return;
    if (turns.length >= 98) {
      notify(t("continueChat"));
      return;
    }
    const message = input.trim(),
      id = thread?.id || createClientId(),
      history = turns;
    const userMessage: StudioMessage = {
      id: createClientId(),
      role: "user",
      text: message,
    };
    const next = thread
      ? threads.map((item) =>
          item.id === id
            ? {
                ...item,
                messages: [...item.messages, userMessage],
                updatedAt: Date.now(),
              }
            : item,
        )
      : [
          {
            id,
            title: message.slice(0, 70),
            messages: [userMessage],
            updatedAt: Date.now(),
          },
          ...threads,
        ];
    if (next.length > 40 || !persist(next)) {
      notify(t("storageFull"));
      return;
    }
    setActive(id);
    setInput("");
    lock.current = true;
    setBusy(true);
    setPhase("thinking");
    const abort = new AbortController();
    controller.current = abort;
    const current = ++generation.current;
    try {
      const result = await service.request(
        {
          state: structuredClone(state),
          revision: journal.revision,
          message,
          history,
          context,
          selection: {
            courseId: route.course,
            projectId: route.item,
            scope: route.scope,
            screen: route.screen,
          },
        },
        AbortSignal.any([abort.signal, AbortSignal.timeout(60000)]),
        (value) => {
          if (generation.current === current) setPhase(value);
        },
      );
      if (generation.current !== current || abort.signal.aborted) return;
      update(id, (old) => [
        ...old,
        {
          id: createClientId(),
          role: "assistant",
          ...result,
          resolved: !result.proposal,
        },
      ]);
    } catch (error) {
      if (
        generation.current === current &&
        AssistantFailure.from(error, "request").code === "ai-provider-access"
      ) {
        disconnectPollinations(uid);
        setConnected(false);
      }
      if (generation.current === current)
        update(id, (old) => [
          ...old,
          {
            id: createClientId(),
            role: "assistant",
            text:
              (error as Error).message === "assistant-conversation-full"
                ? t("continueChat")
                : friendlyFailure(
                    AssistantFailure.from(error, "request"),
                    state.settings.language,
                  ),
            resolved: true,
            failed: true,
          },
        ]);
    } finally {
      if (generation.current === current) {
        setBusy(false);
        lock.current = false;
      }
    }
  }
  async function apply(message: StudioMessage) {
    if (!message.proposal || !thread) return;
    if (
      await run(
        { kind: "proposal", proposal: message.proposal },
        message.proposal.revision,
      )
    ) {
      update(thread.id, (old) =>
        old.map((item) =>
          item.id === message.id
            ? {
                ...item,
                resolved: true,
                applied: true,
                receipt: { changes: message.proposal!.changes },
                controlResults: message.proposal!.controls.map(() => ({
                  ok: true,
                })),
              }
            : item,
        ),
      );
      for (const control of parseControls(message.proposal.controls))
        if (control.kind === "navigate") {
          const page = String(control.values.page),
            screens: Record<string, typeof route.screen> = {
              personal: "projects",
              resume: "today",
              university: "university",
              groups: "groups",
              settings: "settings",
              notifications: "settings",
              library: "library",
              analytics: "analytics",
              logs: "settings",
              support: "settings",
            };
          navigateStudio({
            screen: screens[page] || "today",
            course: String(control.values.courseId || ""),
            tab: String(control.values.tab || "overview"),
            scope: String(control.values.groupId || "personal"),
            query: String(control.values.search || ""),
            library: String(control.values.view || "archive"),
            filter: String(control.values.filter || "all"),
            section: String(control.values.section || "all"),
            item: "",
          });
        } else if (control.kind === "tour") {
          update(thread.id, (old) => [
            ...old,
            {
              id: createClientId(),
              role: "assistant",
              text: t("studioGuide"),
              resolved: true,
            },
          ]);
        }
    }
  }
  async function connect() {
    setPhase("connecting");
    setBusy(true);
    try {
      await connectPollinations(uid);
      setConnected(pollinationsConnected(uid));
    } catch {
      notify(t("providerError"));
    } finally {
      setBusy(false);
    }
  }
  const controlName = (kind: string) =>
    (
      ({
        profile: "profile",
        appearance: "appearance",
        language: "language",
        sleep: "quiet",
        workflow: "workflow",
        navigate: "open",
        tour: "help",
      }) as Record<string, StudioWord>
    )[kind] || "preferences";
  return (
    <aside
      className="st-assistant"
      ref={panelRef}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          stop();
          close();
        }
        if (event.key === "Tab" && window.innerWidth < 1280) {
          const controls = [
            ...event.currentTarget.querySelectorAll<HTMLElement>(
              "button:not(:disabled),textarea,input,select,summary,a[href]",
            ),
          ].filter((element) => element.getClientRects().length);
          const first = controls[0],
            last = controls.at(-1);
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }
      }}
      role="dialog"
      aria-label={t("assistant")}
      aria-modal={window.innerWidth < 1280}
    >
      <header>
        <span className="st-assistant-mark">
          <Sparkles size={21} />
        </span>
        <div>
          <strong>{t("assistant")}</strong>
          <small>{t("preview")}</small>
        </div>
        <button
          className="st-icon-button"
          aria-label={t("chats")}
          onClick={() => setShowChats(!showChats)}
        >
          <MessageSquarePlus size={19} />
        </button>
        <button
          className="st-icon-button"
          aria-label={t("close")}
          onClick={() => {
            stop();
            close();
          }}
        >
          <X size={20} />
        </button>
      </header>
      {showChats && (
        <section className="st-chat-list">
          <button
            disabled={busy}
            onClick={() => {
              setActive("");
              setInput("");
              setShowChats(false);
            }}
          >
            <MessageSquarePlus size={17} />
            {t("newChat")}
          </button>
          {threads.map((item) => (
            <div key={item.id}>
              <button
                disabled={busy}
                onClick={() => {
                  setActive(item.id);
                  setShowChats(false);
                }}
                dir="auto"
              >
                {item.title}
              </button>
              <button
                disabled={busy}
                className="st-icon-button"
                aria-label={t("deleteChat") + " " + item.title}
                onClick={() => {
                  if (
                    persist(threads.filter((v) => v.id !== item.id)) &&
                    active === item.id
                  )
                    setActive("");
                }}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          <small>{t("savedConversation")}</small>
        </section>
      )}
      <div className="st-assistant-context">
        <span>{t("context")}</span>
        <strong dir="auto">{context}</strong>
      </div>
      {!connected && (
        <div className="st-connect">
          <Plug size={25} />
          <p>{t("connectHint")}</p>
          <button
            className="st-primary"
            disabled={busy}
            onClick={() => void connect()}
          >
            {t("connect")}
          </button>
        </div>
      )}
      {chatBroken && (
        <div className="st-connect">
          <p role="alert">{t("chatBroken")}</p>
          <button
            onClick={() =>
              downloadStudioFile(
                "wilo-conversation-recovery.json",
                localStorage.getItem(storageKey) || "[]",
                "application/json",
              )
            }
          >
            {t("backup")}
          </button>
          <button
            onClick={() => {
              if (!window.confirm(t("resetChats"))) return;
              try {
                const raw = localStorage.getItem(storageKey);
                if (raw) localStorage.setItem(storageKey + "/recovery", raw);
                saveStudioThreads(storageKey, []);
                threadState.current = [];
                setThreads([]);
                setActive("");
                setChatBroken(false);
              } catch {
                notify(t("storageFull"));
              }
            }}
          >
            {t("resetChats")}
          </button>
        </div>
      )}
      <div
        className="st-assistant-messages"
        ref={messagesRef}
        role="log"
        aria-live="polite"
      >
        {!turns.length && (
          <div className="st-assistant-welcome">
            <span className="st-assistant-orbit">
              <Sparkles size={30} />
            </span>
            <h2>{t("assistant")}</h2>
            <p>{t("assistantHint")}</p>
            {(["summarize", "planCourse", "explain"] as const).map((key) => (
              <button
                key={key}
                disabled={busy}
                onClick={() =>
                  setInput(t(key) + (route.course ? " — " + context : ""))
                }
              >
                {t(key)}
              </button>
            ))}
          </div>
        )}
        {turns.map((message) => (
          <article
            className={"st-chat-message st-chat-" + message.role}
            key={message.id}
          >
            <AssistantRichText text={message.text} />
            {message.proposal && !message.resolved && (
              <div className="st-proposal">
                <h3>{t("proposal")}</h3>
                <ol>
                  {message.proposal.changes.map((change, index) => (
                    <li key={index}>
                      <Check size={15} />
                      <div>
                        {t(
                          change.after
                            ? change.before
                              ? "update"
                              : "create"
                            : "delete",
                        )}{" "}
                        · <b dir="auto">{changeName(change)}</b>
                        <ChangeDetails
                          change={change}
                          reply={message.reply}
                          changes={message.proposal!.changes}
                        />
                      </div>
                    </li>
                  ))}
                  {message.proposal.controls.map((control, index) => (
                    <li key={"control-" + index}>
                      <Check size={15} />
                      <span>
                        {t(controlName(control.kind))}:{" "}
                        <b>
                          {Object.values(control.values)
                            .map((value) =>
                              studioValue(
                                value,
                                state,
                                message.proposal?.changes,
                              ),
                            )
                            .join(" · ")}
                        </b>
                      </span>
                    </li>
                  ))}
                </ol>
                <div className="st-dialog-actions">
                  <button
                    className="st-primary"
                    disabled={busy}
                    onClick={() => void apply(message)}
                  >
                    {t("apply")}
                  </button>
                  <button
                    className="st-secondary"
                    disabled={busy}
                    onClick={() =>
                      thread &&
                      update(thread.id, (old) =>
                        old.map((item) =>
                          item.id === message.id
                            ? { ...item, resolved: true, cancelled: true }
                            : item,
                        ),
                      )
                    }
                  >
                    {t("cancel")}
                  </button>
                </div>
              </div>
            )}
            {message.applied && (
              <p className="st-applied">
                <Check size={15} />
                {t("applied")}
              </p>
            )}
            {message.applied &&
              message.receipt?.changes
                .filter((change) => !!change.after)
                .map((change) => (
                  <button
                    className="st-link-button"
                    key={change.target + change.id}
                    onClick={() => {
                      navigateStudio(
                        change.target === "projects" ||
                          change.target === "sections"
                          ? {
                              screen:
                                change.scope === "personal"
                                  ? "projects"
                                  : "groups",
                              scope: change.scope,
                              item:
                                change.target === "projects" ? change.id : "",
                            }
                          : {
                              screen: "university",
                              course:
                                change.target === "courses"
                                  ? change.id
                                  : (change.after as { courseId?: string })
                                      ?.courseId || "",
                              tab:
                                change.target === "tasks"
                                  ? "tasks"
                                  : change.target === "lessons"
                                    ? "schedule"
                                    : "overview",
                              item: "",
                            },
                      );
                      if (window.innerWidth < 1280) close();
                    }}
                  >
                    {t("open")} · {changeName(change)}
                  </button>
                ))}
            {message.cancelled && <small>{t("cancelled")}</small>}
            {message.reply?.files.map((file) => (
              <button
                className="st-file-card"
                key={file.name}
                onClick={() =>
                  void downloadAssistantFile(
                    file,
                    state.settings.language,
                  ).catch(() => notify(t("failed")))
                }
              >
                <Download size={16} />
                {file.name}
              </button>
            ))}
            {message.role === "assistant" && (
              <button
                className="st-copy-message"
                aria-label={t("copy")}
                onClick={() =>
                  void navigator.clipboard
                    .writeText(message.text)
                    .catch(() => notify(t("failed")))
                }
              >
                <Copy size={13} />
              </button>
            )}
          </article>
        ))}
        {busy && (
          <p className="st-assistant-thinking" role="status">
            <LoaderCircle size={16} className="st-spin" />
            {t(phase as StudioWord)}
          </p>
        )}
      </div>
      <form
        className="st-assistant-composer"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <label className="st-sr-only" htmlFor="studio-assistant-input">
          {t("assistant")}
        </label>
        <textarea
          id="studio-assistant-input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          maxLength={4000}
          placeholder={t("assistantHint")}
          rows={2}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void send();
            }
            if (event.key === "Escape") {
              stop();
              close();
            }
          }}
        />
        <div>
          <button
            className="st-icon-button"
            type="button"
            disabled={busy}
            aria-label={t("newChat")}
            onClick={() => {
              setActive("");
              setInput("");
            }}
          >
            <MessageSquarePlus size={19} />
          </button>
          <details className="st-assistant-settings">
            <summary>{t("connection")}</summary>
            <p>{t("connectHint")}</p>
            <p>{t("savedConversation")}</p>
            {connected && (
              <button
                type="button"
                onClick={() => {
                  disconnectPollinations(uid);
                  setConnected(false);
                }}
              >
                {t("disconnect")}
              </button>
            )}
          </details>
          {busy ? (
            <button type="button" className="st-primary" onClick={stop}>
              <Square size={16} />
              {t("stop")}
            </button>
          ) : (
            <button
              className="st-primary"
              disabled={!connected || !input.trim() || chatBroken}
            >
              <ArrowUp size={18} />
              {t("send")}
            </button>
          )}
        </div>
      </form>
    </aside>
  );
}

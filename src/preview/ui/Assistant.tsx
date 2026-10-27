import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import {
  ArrowUp,
  Check,
  Download,
  LoaderCircle,
  MessageSquarePlus,
  Plug,
  Square,
  X,
  Sparkles,
} from "lucide-react";
import AssistantRichText from "../../assistant/AssistantRichText";
import { assistantFieldNames } from "../../assistant/words";
import { downloadAssistantFile } from "../../assistant/pdfExport";
import { AssistantFailure } from "../../assistant/failure";
import { friendlyFailure } from "../../assistant/friendlyFailure";
import { createClientId } from "../../lib/clientId";
import type { Change } from "../../assistant/actions";
import { readPreviewThreads, savePreviewThreads } from "../adapters/assistant";
import type {
  PreviewAssistantPort,
  PreviewMessage,
  PreviewThread,
} from "../adapters/assistant";
import {
  connectPreviewPollinations,
  disconnectPreviewPollinations,
  previewPollinationsConnected,
} from "../adapters/credentials";
import { downloadPreviewFile } from "../adapters/download";
import { parseControls } from "../../assistant/controlContract";
import { usePreview, go } from "./context";
import Disclosure from "./Disclosure";
export default function Assistant({
  uid,
  storageKey,
  service,
  close,
}: {
  uid: string;
  storageKey: string;
  service: PreviewAssistantPort;
  close: () => void;
}) {
  const { state, journal, route, t, run, notify } = usePreview(),
    ref = useRef<HTMLDialogElement>(null),
    list = useRef<HTMLDivElement>(null);
  const [loaded] = useState(() => {
    try {
      return { threads: readPreviewThreads(storageKey), broken: false };
    } catch {
      return { threads: [] as PreviewThread[], broken: true };
    }
  });
  const [threads, setThreads] = useState(loaded.threads),
    [broken, setBroken] = useState(loaded.broken),
    [active, setActive] = useState(loaded.threads[0]?.id || ""),
    [text, setText] = useState(""),
    [busy, setBusy] = useState(false),
    [phase, setPhase] = useState("thinking"),
    [connected, setConnected] = useState(() =>
      previewPollinationsConnected(uid),
    );
  const pending = useRef(false),
    generation = useRef({ value: 0 }),
    abort = useRef<AbortController | null>(null),
    threadRef = useRef(loaded.threads),
    mounted = useRef(true);
  const thread = threads.find((item) => item.id === active);
  useEffect(() => {
    const dialog = ref.current!,
      previous = document.activeElement as HTMLElement;
    const token = generation.current;
    mounted.current = true;
    if (matchMedia("(max-width: 760px)").matches) dialog.showModal();
    else dialog.show();
    return () => {
      mounted.current = false;
      token.value++;
      abort.current?.abort();
      dialog.close();
      previous?.focus({ preventScroll: true });
    };
  }, []);
  useEffect(() => {
    list.current?.scrollTo({
      top: list.current.scrollHeight,
      behavior: "auto",
    });
  }, [threads, busy, phase]);
  function persist(next: PreviewThread[]) {
    if (broken) return false;
    try {
      savePreviewThreads(storageKey, next);
      threadRef.current = next;
      setThreads(next);
      return true;
    } catch (error) {
      notify(
        t(
          (error as Error).message === "assistant-conversation-full"
            ? "continueChat"
            : "error",
        ),
      );
      return false;
    }
  }
  function update(
    id: string,
    fn: (messages: PreviewMessage[]) => PreviewMessage[],
  ) {
    return persist(
      threadRef.current.map((item) =>
        item.id === id
          ? { ...item, messages: fn(item.messages), updatedAt: Date.now() }
          : item,
      ),
    );
  }
  function stop() {
    generation.current.value++;
    abort.current?.abort();
    pending.current = false;
    setBusy(false);
    if (thread)
      update(thread.id, (old) => [
        ...old,
        {
          id: createClientId(),
          role: "assistant",
          text: t("stopped"),
          failed: true,
          resolved: true,
        },
      ]);
  }
  async function send() {
    if (pending.current || !text.trim() || broken || !connected) return;
    if ((thread?.messages.length || 0) >= 98) {
      notify(t("continueChat"));
      return;
    }
    pending.current = true;
    const controller = new AbortController();
    abort.current = controller;
    const token = ++generation.current.value,
      message = text.trim();
    let id = active;
    const userMessage: PreviewMessage = {
      id: createClientId(),
      role: "user",
      text: message,
    };
    const history = thread?.messages || [];
    if (!id) {
      id = createClientId();
      if (
        !persist(
          [
            {
              id,
              title: message.slice(0, 70),
              messages: [userMessage],
              updatedAt: Date.now(),
            },
            ...threadRef.current,
          ].slice(0, 40),
        )
      ) {
        pending.current = false;
        return;
      }
      setActive(id);
    } else if (!update(id, (old) => [...old, userMessage])) {
      pending.current = false;
      return;
    }
    setText("");
    setBusy(true);
    setPhase("thinking");
    try {
      const result = await service.request(
        {
          state: structuredClone(state),
          revision: journal.revision,
          message,
          history,
          context:
            "Isolated original-style administrator preview; changes and reminders stay in this browser only.",
          selection: {
            screen: route.screen,
            courseId: route.course,
            projectId: "",
            scope: route.scope,
          },
        },
        AbortSignal.any([controller.signal, AbortSignal.timeout(60000)]),
        (value) => {
          if (mounted.current && generation.current.value === token)
            setPhase(value);
        },
      );
      if (!mounted.current || generation.current.value !== token) return;
      update(id, (old) => [
        ...old,
        {
          id: createClientId(),
          role: "assistant",
          text: result.text,
          reply: result.reply,
          proposal: result.proposal,
          resolved: !result.proposal,
        },
      ]);
    } catch (error) {
      if (mounted.current && generation.current.value === token) {
        const failure = AssistantFailure.from(error, "request");
        if (failure.code === "ai-provider-access") {
          disconnectPreviewPollinations(uid);
          setConnected(false);
        }
        update(id, (old) => [
          ...old,
          {
            id: createClientId(),
            role: "assistant",
            text:
              (error as Error).message === "assistant-conversation-full"
                ? t("continueChat")
                : friendlyFailure(failure, state.settings.language),
            failed: true,
            resolved: true,
          },
        ]);
      }
    } finally {
      if (mounted.current && generation.current.value === token) {
        pending.current = false;
        setBusy(false);
      }
    }
  }
  async function apply(message: PreviewMessage) {
    if (!message.proposal || !thread) return;
    const controls = parseControls(message.proposal.controls);
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
                applied: true,
                resolved: true,
                receipt: { changes: message.proposal!.changes },
                controlResults: controls.map(() => ({ ok: true })),
              }
            : item,
        ),
      );
      for (const control of controls)
        if (control.kind === "navigate") {
          const screen = String(control.values.page);
          go({
            screen:
              screen === "university"
                ? "university"
                : screen === "settings"
                  ? "settings"
                  : "projects",
            course: String(control.values.courseId || ""),
            tab: "overview",
            scope: String(control.values.groupId || "personal"),
          });
        } else if (control.kind === "tour") notify(t("hint"));
    }
  }
  function changeTitle(change: Change) {
    const record = (change.after || change.before) as {
      name?: string;
      title?: string;
      room?: string;
    };
    return record?.name || record?.title || record?.room || t("lesson");
  }
  function valueText(value: unknown): string {
    if (value == null || value === "") return "—";
    if (typeof value === "boolean") return value ? "✓" : "—";
    if (Array.isArray(value))
      return value
        .map((item) =>
          typeof item === "object" && item && "title" in item
            ? String(item.title)
            : valueText(item),
        )
        .join(" · ");
    if (typeof value === "object") return "…";
    const key = String(value);
    return (
      state.data.study.courses.find((item) => item.id === key)?.name ||
      state.data.scopes
        .flatMap((scope) => scope.sections)
        .find((item) => item.id === key)?.name ||
      key
    );
  }
  return (
    <dialog
      ref={ref}
      className="assistant-panel preview-assistant"
      aria-label={t("assistant")}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          close();
        }
      }}
    >
      <header className="assistant-header">
        <span className="assistant-brand-mark">
          <Sparkles size={24} />
        </span>
        <div className="assistant-heading">
          <strong>{t("assistant")}</strong>
          <span>{t("preview")}</span>
        </div>
        <button
          className="assistant-close"
          aria-label={t("close")}
          onClick={close}
        >
          <X size={20} />
        </button>
      </header>
      <div className="preview-chat-tools">
        <button
          className="text-button"
          disabled={busy}
          onClick={() => {
            setActive("");
            setText("");
          }}
        >
          <MessageSquarePlus size={16} />
          {t("newChat")}
        </button>
        <Disclosure title={t("options")}>
          <div className="preview-chat-list">
            {threads.slice(0, 20).map((item) => (
              <button
                className="text-button"
                disabled={busy}
                aria-pressed={active === item.id}
                key={item.id}
                onClick={() => setActive(item.id)}
                dir="auto"
              >
                {item.title}
              </button>
            ))}
            {connected && (
              <button
                className="text-button"
                disabled={busy}
                onClick={() => {
                  disconnectPreviewPollinations(uid);
                  setConnected(false);
                }}
              >
                <Plug size={16} />
                {t("disconnect")}
              </button>
            )}
          </div>
        </Disclosure>
      </div>
      {!connected && (
        <div className="assistant-intro">
          <p>{t("copyHint")}</p>
          <button
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void connectPreviewPollinations(uid)
                .then(() => {
                  if (mounted.current)
                    setConnected(previewPollinationsConnected(uid));
                })
                .catch(() => notify(t("error")))
                .finally(() => {
                  if (mounted.current) setBusy(false);
                });
            }}
          >
            <Plug size={17} />
            {t("connect")}
          </button>
        </div>
      )}
      {broken && (
        <div role="alert">
          <p>{t("recoverHint")}</p>
          <button
            onClick={() =>
              downloadPreviewFile(
                "preview-chat-recovery.json",
                localStorage.getItem(storageKey) || "[]",
                "application/json",
              )
            }
          >
            {t("backup")}
          </button>
          <button
            onClick={() => {
              try {
                const raw = localStorage.getItem(storageKey);
                if (raw) localStorage.setItem(storageKey + "/recovery", raw);
                localStorage.removeItem(storageKey);
                threadRef.current = [];
                setThreads([]);
                setActive("");
                setBroken(false);
              } catch {
                notify(t("error"));
              }
            }}
          >
            {t("reset")}
          </button>
        </div>
      )}
      <div
        ref={list}
        className="assistant-messages"
        role="log"
        aria-live="polite"
        aria-relevant="additions text"
      >
        {!thread?.messages.length && (
          <div className="assistant-intro">
            <Sparkles size={24} />
            <p>{t("welcome")}</p>
          </div>
        )}
        {thread?.messages.map((message) => (
          <motion.article
            key={message.id}
            className={"assistant-message " + message.role}
            initial={{ opacity: 0, y: 7 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
          >
            <AssistantRichText text={message.text} />
            {message.proposal && !message.resolved && (
              <section className="assistant-proposal">
                <strong>
                  {t("repairing")} (
                  {message.proposal.changes.length +
                    message.proposal.controls.length}
                  )
                </strong>
                <ul>
                  {message.proposal.changes.map((change, i) => (
                    <li key={i}>
                      <strong dir="auto">{changeTitle(change)}</strong>
                      <Disclosure title={t("details")}>
                        <dl className="preview-change-fields">
                          {Object.entries(
                            (change.after || change.before || {}) as Record<
                              string,
                              unknown
                            >,
                          )
                            .filter(
                              ([field, value]) =>
                                ![
                                  "id",
                                  "revision",
                                  "updatedAt",
                                  "rank",
                                  "x",
                                  "y",
                                  "mutationId",
                                  "activityAt",
                                  "completedAt",
                                ].includes(field) &&
                                JSON.stringify(value) !==
                                  JSON.stringify(
                                    (
                                      change.before as Record<
                                        string,
                                        unknown
                                      > | null
                                    )?.[field],
                                  ),
                            )
                            .map(([field, value]) => (
                              <div key={field}>
                                <dt>
                                  {assistantFieldNames[field]?.[
                                    state.settings.language === "ar"
                                      ? 0
                                      : state.settings.language === "he"
                                        ? 2
                                        : 1
                                  ] || field}
                                </dt>
                                <dd dir="auto">{valueText(value)}</dd>
                              </div>
                            ))}
                        </dl>
                      </Disclosure>
                    </li>
                  ))}
                  {message.proposal.controls.map((control, i) => (
                    <li key={"control-" + i}>
                      {control.kind}:{" "}
                      {Object.values(control.values).map(valueText).join(" · ")}
                    </li>
                  ))}
                </ul>
                <div className="preview-actions">
                  <button disabled={busy} onClick={() => void apply(message)}>
                    <Check size={16} />
                    {t("apply")}
                  </button>
                  <button
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
              </section>
            )}
            {message.applied && (
              <small className="preview-receipt">
                <Check size={15} />
                {t("applied")}
              </small>
            )}
            {message.reply?.files.map((file, i) => (
              <button
                className="assistant-file"
                key={i}
                onClick={() =>
                  void downloadAssistantFile(
                    file,
                    state.settings.language,
                  ).catch(() => notify(t("error")))
                }
              >
                <Download size={17} />
                {file.name}
              </button>
            ))}
          </motion.article>
        ))}
        {busy && (
          <div className="preview-waiting" role="status">
            <LoaderCircle size={18} />
            {t(
              phase === "reading"
                ? "reading"
                : phase === "repairing"
                  ? "repairing"
                  : phase === "receiving"
                    ? "receiving"
                    : "thinking",
            )}
          </div>
        )}
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <label htmlFor="preview-message">{t("message")}</label>
        <textarea
          id="preview-message"
          value={text}
          disabled={busy || broken}
          maxLength={6000}
          rows={2}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void send();
            }
          }}
        />
        <div className="preview-actions">
          {busy ? (
            <button type="button" onClick={stop}>
              <Square size={16} />
              {t("stop")}
            </button>
          ) : (
            <button
              type="submit"
              disabled={!connected || !text.trim() || broken}
            >
              <ArrowUp size={17} />
              {t("send")}
            </button>
          )}
        </div>
      </form>
    </dialog>
  );
}

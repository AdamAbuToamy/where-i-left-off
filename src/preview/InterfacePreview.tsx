import {
  Component,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import type { User } from "firebase/auth";
import { MotionConfig, AnimatePresence, motion } from "motion/react";
import {
  ArrowRight,
  Archive,
  Check,
  Download,
  FlaskConical,
  Folder,
  GraduationCap,
  RotateCcw,
  RotateCw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import type { Language } from "../translations";
import { translations } from "../translations";
import { StudyLocaleProvider } from "../university/StudyLocale";
import { auth, db } from "../lib/firebase";
import { isAdmin } from "../lib/admin";
import { readTheme, readBackground, themes } from "../lib/theme";
import { PreviewRepository } from "./core/repository";
import { previewSeed } from "./core/seed";
import { BrowserPreviewPersistence } from "./adapters/browserPersistence";
import { copyAccountIntoPreview } from "./adapters/readAccount";
import { PollinationsPreviewAssistant } from "./adapters/assistant";
import { downloadPreviewFile } from "./adapters/download";
import { validatePreviewState } from "./core/validation";
import { previewCalendar, previewCsv } from "./core/calendar";
import { searchPreview } from "./core/selectors";
import { downloadAssistantFile } from "../assistant/pdfExport";
import type { PreviewAssistantPort } from "./adapters/assistant";
import type { PreviewCommand, PreviewJournal } from "./core/model";
import { PreviewContext, defaultRoute, go, readRoute } from "./ui/context";
import type { Editor as EditorValue } from "./ui/context";
import { word } from "./ui/words";
import type { Word } from "./ui/words";
import Disclosure from "./ui/Disclosure";
import Editor from "./ui/Editor";
import Dialog from "./ui/Dialog";
import University from "./ui/University";
import "../university/university.css";
import "../assistant/assistant.css";
import "../components/ProjectCard.css";
import "./preview.css";
const Projects = lazy(() => import("./ui/Projects"));
const Assistant = lazy(() => import("./ui/Assistant"));
export default function InterfacePreview({
  user,
  language,
  service,
}: {
  user: User;
  language: Language;
  service?: PreviewAssistantPort;
}) {
  if (!isAdmin(user.email, user.emailVerified))
    return <p role="alert">Access denied</p>;
  const key = `wilo-interface-preview-v1/${db?.app.options.projectId || "local"}/${user.uid}`;
  return (
    <Recovery storageKey={key} language={language} uid={user.uid}>
      <Workspace
        key={user.uid}
        user={user}
        language={language}
        storageKey={key}
        service={service}
      />
    </Recovery>
  );
}
function Workspace({
  user,
  language,
  storageKey,
  service,
}: {
  user: User;
  language: Language;
  storageKey: string;
  service?: PreviewAssistantPort;
}) {
  const [repository] = useState(
    () =>
      new PreviewRepository(
        new BrowserPreviewPersistence(
          storageKey,
          () => auth?.currentUser || null,
          user.uid,
        ),
        () => {
          const initial = previewSeed(
            Date.now(),
            user.displayName || "WILO",
            language,
          );
          initial.settings.theme = readTheme(user.uid);
          initial.settings.background = readBackground(user.uid);
          return initial;
        },
        Date.now,
      ),
  );
  const [journal, setJournal] = useState<PreviewJournal>(() =>
      repository.read(),
    ),
    [route, setRoute] = useState(readRoute),
    [now, setNow] = useState(Date.now),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [editing, setEditing] = useState<EditorValue | null>(null),
    [assistant, setAssistant] = useState(false),
    [searchOpen, setSearchOpen] = useState(false),
    [search, setSearch] = useState(""),
    [reduced, setReduced] = useState(false);
  const [provider] = useState(
    () => service || new PollinationsPreviewAssistant(user.uid),
  );
  const current = useRef(journal),
    locked = useRef(false),
    mounted = useRef(true),
    [systemReduced, setSystemReduced] = useState(
      () => matchMedia("(prefers-reduced-motion: reduce)").matches,
    ),
    content = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const changed = () => setSystemReduced(query.matches);
    query.addEventListener("change", changed);
    return () => query.removeEventListener("change", changed);
  }, []);
  const state = journal.current,
    previewLanguage = state.settings.language;
  const t = useCallback(
    (key: Word) => word(previewLanguage, key),
    [previewLanguage],
  );
  const notify = useCallback((message: string) => setNotice(message), []);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    const change = () => setRoute(readRoute());
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  useEffect(() => {
    void repository
      .initialize()
      .then((next) => {
        if (mounted.current) {
          current.current = next;
          setJournal(next);
        }
      })
      .catch(() => notify(word(language, "error")));
    return repository.subscribe(() => {
      try {
        const next = repository.read();
        current.current = next;
        setJournal(next);
      } catch {
        notify(word(language, "error"));
      }
    });
  }, [repository, notify, language]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 7000);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    const element = content.current;
    if (!element) return;
    const query = matchMedia("(max-width: 760px)");
    const update = () => {
      element.inert = assistant && query.matches;
    };
    update();
    query.addEventListener("change", update);
    return () => {
      element.inert = false;
      query.removeEventListener("change", update);
    };
  }, [assistant]);
  const run = useCallback(
    async (command: PreviewCommand, revision = current.current.revision) => {
      if (locked.current) return false;
      locked.current = true;
      setBusy(true);
      const before = current.current;
      try {
        const next = await repository.execute(command, revision);
        if (!mounted.current) return false;
        current.current = next;
        setJournal(next);
        notify(t("saved"));
        if (
          command.kind === "actions" &&
          command.actions.length === 1 &&
          command.actions[0].target === "courses" &&
          command.actions[0].action === "create"
        ) {
          const added = next.current.data.study.courses.find(
            (course) =>
              !before.current.data.study.courses.some(
                (old) => old.id === course.id,
              ),
          );
          if (added)
            go({
              screen: "university",
              course: added.id,
              tab: "overview",
              term: command.semesterId || "current",
            });
        }
        return true;
      } catch (error) {
        if (mounted.current)
          notify(
            (error as Error).message === "preview-conflict"
              ? t("conflict")
              : t("error"),
          );
        return false;
      } finally {
        locked.current = false;
        if (mounted.current) setBusy(false);
      }
    },
    [repository, t, notify],
  );
  useEffect(() => {
    const keys = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (!assistant) setSearchOpen(true);
      }
      if (
        event.key.toLowerCase() === "z" &&
        !(
          event.target instanceof HTMLElement &&
          event.target.closest("input,textarea,[contenteditable=true]")
        )
      ) {
        event.preventDefault();
        void run({ kind: event.shiftKey ? "redo" : "undo" });
      }
    };
    window.addEventListener("keydown", keys);
    return () => window.removeEventListener("keydown", keys);
  }, [run, assistant]);
  async function copyAccount() {
    if (busy || !confirm(t("confirm"))) return;
    const revision = current.current.revision;
    setBusy(true);
    try {
      const copy = await copyAccountIntoPreview(
        user.uid,
        current.current.current,
      );
      await run({ kind: "replace", state: copy }, revision);
    } catch (error) {
      notify(
        t(
          (error as Error).message === "preview-account-pending"
            ? "pendingAccount"
            : "error",
        ),
      );
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  async function importFile(file: File) {
    const revision = current.current.revision;
    try {
      if (file.size > 4500000) throw new Error("size");
      const value = validatePreviewState(JSON.parse(await file.text()));
      await run({ kind: "replace", state: value }, revision);
    } catch {
      notify(t("error"));
    }
  }
  async function pdf() {
    try {
      const lines =
        route.screen === "projects"
          ? state.data.scopes
              .find((scope) => scope.id === route.scope)
              ?.projects.map(
                (project) =>
                  `## ${project.name}\n${project.nextStep}\n${project.dueDate || ""}\n${project.description || ""}`,
              ) || []
          : state.data.study.courses
              .filter((course) => !route.course || course.id === route.course)
              .map(
                (course) =>
                  `## ${course.name}\n${course.notes}\n${state.data.study.tasks
                    .filter((task) => task.courseId === course.id)
                    .map(
                      (task) =>
                        `${task.done ? "✓" : "□"} ${task.title} — ${task.due}`,
                    )
                    .join("\n")}`,
              );
      const text = lines.join("\n\n");
      if (text.length > 30000) {
        notify(t("exportLimit"));
        return;
      }
      if (!text.trim()) {
        notify(t("empty"));
        return;
      }
      await downloadAssistantFile(
        { name: "wilo-preview-summary.pdf", content: text },
        previewLanguage,
      );
    } catch {
      notify(t("error"));
    }
  }
  const results = searchPreview(state, search);
  return (
    <StudyLocaleProvider value={previewLanguage}>
      <MotionConfig
        reducedMotion={reduced || systemReduced ? "always" : "user"}
      >
        <PreviewContext.Provider
          value={{
            state,
            journal,
            route,
            now,
            busy,
            reduced: reduced || !!systemReduced,
            t,
            run,
            act: (actions) => run({ kind: "actions", actions }),
            edit: setEditing,
            notify,
          }}
        >
          <main
            className={
              "workspace admin-preview " +
              (assistant ? "preview-assistant-open" : "")
            }
            dir={previewLanguage === "en" ? "ltr" : "rtl"}
            data-preview-theme={state.settings.theme}
            data-preview-background={state.settings.background}
            data-reduced={reduced || systemReduced}
          >
            <div ref={content}>
              <header className="page-header">
                <div className="heading-copy">
                  <h1>{translations[previewLanguage].appName}</h1>
                </div>
                <a className="secondary-button" href="#/admin">
                  <ArrowRight size={17} />
                  {t("back")}
                </a>
              </header>
              <div className="preview-banner">
                <span>
                  <FlaskConical size={17} />
                  {t("hint")}
                </span>
                <ShieldCheck size={17} />
              </div>
              <div className="preview-toolbar">
                <nav className="preview-main-tabs" aria-label={t("preview")}>
                  {(
                    [
                      ["university", GraduationCap],
                      ["projects", Folder],
                      ["settings", Settings2],
                    ] as const
                  ).map(([screen, Icon]) => (
                    <button
                      type="button"
                      className="secondary-button"
                      key={screen}
                      aria-pressed={route.screen === screen}
                      onClick={() => go({ ...defaultRoute, screen })}
                    >
                      <Icon size={18} />
                      <span>{t(screen)}</span>
                    </button>
                  ))}
                </nav>
                <div className="preview-actions">
                  <button
                    className="preview-icon"
                    disabled={busy || !journal.undo.length}
                    aria-label={t("undo")}
                    onClick={() => void run({ kind: "undo" })}
                  >
                    <RotateCcw size={19} />
                  </button>
                  <button
                    className="preview-icon"
                    disabled={busy || !journal.redo.length}
                    aria-label={t("redo")}
                    onClick={() => void run({ kind: "redo" })}
                  >
                    <RotateCw size={19} />
                  </button>
                  <button
                    className="preview-icon"
                    aria-label={t("search")}
                    onClick={() => setSearchOpen(true)}
                  >
                    <Search size={19} />
                  </button>
                </div>
              </div>
              <Disclosure
                className="preview-tools"
                title={
                  <>
                    <Download size={16} />
                    {t("tools")}
                  </>
                }
              >
                <div className="preview-actions">
                  <button
                    className="secondary-button"
                    onClick={() =>
                      downloadPreviewFile(
                        "wilo-preview-backup.json",
                        JSON.stringify(state, null, 2),
                        "application/json",
                      )
                    }
                  >
                    {t("backup")}
                  </button>
                  <label className="secondary-button preview-upload">
                    <Upload size={16} />
                    {t("import")}
                    <input
                      type="file"
                      accept="application/json,.json"
                      disabled={busy}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void importFile(file);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <button
                    className="secondary-button"
                    disabled={busy}
                    onClick={() => void copyAccount()}
                  >
                    {t("copy")}
                  </button>
                  <button
                    className="secondary-button"
                    onClick={() =>
                      downloadPreviewFile(
                        "wilo-preview.ics",
                        previewCalendar(state, now, route.course),
                        "text/calendar;charset=utf-8",
                      )
                    }
                  >
                    {t("calendar")}
                  </button>
                  <button
                    className="secondary-button"
                    onClick={() => void pdf()}
                  >
                    {t("pdf")}
                  </button>
                  <button
                    className="secondary-button"
                    onClick={() =>
                      downloadPreviewFile(
                        "wilo-preview.csv",
                        previewCsv(state),
                        "text/csv;charset=utf-8",
                      )
                    }
                  >
                    {t("csv")}
                  </button>
                </div>
                <p>{t("copyHint")}</p>
              </Disclosure>
              <AnimatePresence mode="wait" initial={false}>
                <motion.section
                  key={route.screen}
                  data-preview-screen={route.screen}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18 }}
                >
                  <Suspense fallback={<p role="status">…</p>}>
                    {route.screen === "projects" ? (
                      <Projects />
                    ) : route.screen === "settings" ? (
                      <section className="preview-settings">
                        <h2>
                          <Settings2 size={24} />
                          {t("settings")}
                        </h2>
                        <label>
                          {t("palette")}
                          <select
                            aria-label={t("palette")}
                            value={state.settings.theme}
                            onChange={(e) =>
                              void run({
                                kind: "settings",
                                values: {
                                  theme: e.target
                                    .value as (typeof themes)[number],
                                },
                              })
                            }
                          >
                            {themes.map((theme) => (
                              <option key={theme} value={theme}>
                                {theme === "original" ? t("original") : theme}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          {t("motion")}
                          <select
                            aria-label={t("motion")}
                            value={reduced ? "reduced" : "normal"}
                            onChange={(e) =>
                              setReduced(e.target.value === "reduced")
                            }
                          >
                            <option value="normal">{t("normal")}</option>
                            <option value="reduced">{t("reduced")}</option>
                          </select>
                        </label>
                        <div className="preview-actions">
                          <button
                            className="secondary-button"
                            disabled={busy}
                            onClick={() => void run({ kind: "checkpoint" })}
                          >
                            <Archive size={17} />
                            {t("checkpoint")}
                          </button>
                          <button
                            className="secondary-button"
                            disabled={busy || !journal.checkpoint}
                            onClick={() => void run({ kind: "restore" })}
                          >
                            <RotateCcw size={17} />
                            {t("restore")}
                          </button>
                          <button
                            className="secondary-button"
                            disabled={busy}
                            onClick={() => {
                              if (confirm(t("confirm")))
                                void run({
                                  kind: "replace",
                                  state: previewSeed(
                                    now,
                                    user.displayName || "WILO",
                                    previewLanguage,
                                  ),
                                });
                            }}
                          >
                            {t("reset")}
                          </button>
                        </div>
                        <p>{t("reminderHint")}</p>
                        <p>{t("copyHint")}</p>
                      </section>
                    ) : (
                      <University />
                    )}
                  </Suspense>
                </motion.section>
              </AnimatePresence>
              <button
                className="assistant-launcher preview-launcher"
                onClick={() => setAssistant(true)}
                aria-expanded={assistant}
              >
                <Sparkles size={20} />
                {t("assistant")}
              </button>
              {editing && (
                <Editor
                  key={
                    editing.kind +
                    ("value" in editing ? editing.value?.id || "new" : "new")
                  }
                  value={editing}
                  close={() => setEditing(null)}
                />
              )}
              {searchOpen && (
                <Dialog title={t("search")} close={() => setSearchOpen(false)}>
                  <label className="preview-global-search">
                    {t("search")}
                    <input
                      autoFocus
                      type="search"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </label>
                  <ul className="preview-search-results">
                    {results.map((result) => (
                      <li key={result.key}>
                        <button
                          onClick={() => {
                            go({
                              screen:
                                result.kind === "project"
                                  ? "projects"
                                  : "university",
                              scope: result.scope || "personal",
                              course:
                                result.courseId ||
                                (result.kind === "course" ? result.id : ""),
                              term: "all",
                              tab:
                                result.kind === "lesson"
                                  ? "schedule"
                                  : result.kind === "task"
                                    ? "tasks"
                                    : "overview",
                              filter: "all",
                            });
                            setSearchOpen(false);
                          }}
                        >
                          <strong dir="auto">{result.title}</strong>
                          <small dir="auto">{result.detail}</small>
                        </button>
                      </li>
                    ))}
                  </ul>
                  {search && !results.length && <p>{t("empty")}</p>}
                </Dialog>
              )}
            </div>
            <AnimatePresence>
              {notice && (
                <motion.div
                  role="status"
                  className="preview-toast"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                >
                  <Check size={17} />
                  <span>{notice}</span>
                  <button
                    className="preview-icon"
                    aria-label={t("close")}
                    onClick={() => setNotice("")}
                  >
                    <X size={17} />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
            {assistant && (
              <Suspense fallback={<p role="status">…</p>}>
                <Assistant
                  uid={user.uid}
                  service={provider}
                  storageKey={storageKey + "/chats"}
                  close={() => setAssistant(false)}
                />
              </Suspense>
            )}
          </main>
        </PreviewContext.Provider>
      </MotionConfig>
    </StudyLocaleProvider>
  );
}
class Recovery extends Component<
  { storageKey: string; uid: string; language: Language; children: ReactNode },
  { failed: boolean; error: boolean }
> {
  state = { failed: false, error: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  private check() {
    if (
      auth?.currentUser?.uid !== this.props.uid ||
      !isAdmin(auth.currentUser.email, auth.currentUser.emailVerified)
    )
      throw new Error("permission");
  }
  render() {
    if (!this.state.failed) return this.props.children;
    const t = (key: Word) => word(this.props.language, key);
    return (
      <main className="workspace admin-preview">
        <h1>{t("recovery")}</h1>
        <p>{t("recoverHint")}</p>
        <div className="preview-actions">
          <button
            className="secondary-button"
            onClick={() => {
              try {
                this.check();
                downloadPreviewFile(
                  "wilo-preview-recovery.json",
                  localStorage.getItem(this.props.storageKey) || "{}",
                  "application/json",
                );
              } catch {
                this.setState({ error: true });
              }
            }}
          >
            {t("backup")}
          </button>
          <button
            className="secondary-button"
            onClick={() => {
              if (!confirm(t("confirm"))) return;
              try {
                this.check();
                const raw = localStorage.getItem(this.props.storageKey);
                if (raw)
                  localStorage.setItem(
                    this.props.storageKey + "/recovery",
                    raw,
                  );
                localStorage.removeItem(this.props.storageKey);
                this.setState({ failed: false, error: false });
              } catch {
                this.setState({ error: true });
              }
            }}
          >
            {t("reset")}
          </button>
          <a href="#/admin">{t("back")}</a>
        </div>
        {this.state.error && <p role="alert">{t("error")}</p>}
      </main>
    );
  }
}

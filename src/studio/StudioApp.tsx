import StorageRecovery from "./ui/StorageRecovery";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { MotionConfig, motion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  LayoutDashboard,
  Library,
  Menu,
  Pause,
  Plus,
  Redo2,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Undo2,
  Users,
  X,
} from "lucide-react";
import type { User } from "firebase/auth";
import type { Language } from "../translations";
import { auth, db } from "../lib/firebase";
import { isAdmin } from "../lib/admin";
import { createClientId } from "../lib/clientId";
import { StudioRepository } from "./core/repository";
import { studioSeed } from "./core/seed";
import { BrowserStudioPersistence } from "./adapters/browserPersistence";
import { PollinationsStudioAssistant } from "./adapters/assistant";
import type { StudioAssistantPort } from "./adapters/assistant";
import type { StudioCommand, StudioJournal, StudioScreen } from "./core/model";
import { StudioContext } from "./ui/context";
import type { EditorRequest, FocusTarget } from "./ui/context";
import { studioWord } from "./ui/copy";
import { navigateStudio, useStudioRoute } from "./ui/navigation";
import { StudioDialog } from "./ui/primitives";
import { StudioExportMenu } from "./ui/ExportMenu";
import TodayPage from "./ui/TodayPage";
import ProjectsPage from "./ui/ProjectsPage";
import StudioEditor from "./ui/Editor";
import ProjectDetails from "./ui/ProjectDetails";
import SearchPalette from "./ui/SearchPalette";
import StudioAssistantPanel from "./ui/AssistantPanel";
import "./studio.css";
const UniversityPage = lazy(() => import("./ui/UniversityPage"));
const LibraryPage = lazy(() => import("./ui/LibraryPage"));
const AnalyticsPage = lazy(() => import("./ui/AnalyticsPage"));
const SettingsPage = lazy(() => import("./ui/SettingsPage"));
const screens = [
  { id: "today", Icon: LayoutDashboard },
  { id: "projects", Icon: BookOpen },
  { id: "university", Icon: GraduationCap },
  { id: "groups", Icon: Users },
  { id: "library", Icon: Library },
  { id: "analytics", Icon: BarChart3 },
  { id: "settings", Icon: Settings },
] as const;
function useCompactLayout() {
  const [compact, setCompact] = useState(() => window.innerWidth < 1280);
  useEffect(() => {
    const changed = () => setCompact(window.innerWidth < 1280);
    window.addEventListener("resize", changed);
    return () => window.removeEventListener("resize", changed);
  }, []);
  return compact;
}
function readFocus(key: string): FocusTarget | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) || "null");
    return value &&
      typeof value.id === "string" &&
      typeof value.name === "string" &&
      Number.isFinite(value.startedAt) &&
      value.startedAt <= Date.now() &&
      value.startedAt > Date.now() - 86400000
      ? value
      : null;
  } catch {
    return null;
  }
}
function FocusClock({
  target,
  finish,
  label,
}: {
  target: FocusTarget;
  finish: () => void;
  label: string;
}) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const seconds = Math.max(0, Math.floor((now - target.startedAt) / 1000));
  return (
    <div className="st-focus-clock" role="status">
      <span className="st-focus-pulse" />
      <strong dir="auto">{target.name}</strong>
      <time dir="ltr">
        {String(Math.floor(seconds / 60)).padStart(2, "0")}:
        {String(seconds % 60).padStart(2, "0")}
      </time>
      <button onClick={finish}>
        <Pause size={15} />
        {label}
      </button>
    </div>
  );
}
/** Composition root: only the admin route loads this application and its scoped styles. */
type StudioAppProps = {
  user: User;
  language: Language;
  assistantService?: StudioAssistantPort;
};
export default function StudioApp(props: StudioAppProps) {
  if (!isAdmin(props.user.email, props.user.emailVerified))
    return <p role="alert">{studioWord(props.language, "permission")}</p>;
  const storageKey = `wilo-admin-studio-v1/${db?.app.options.projectId || "local"}/${props.user.uid}`;
  return (
    <StorageRecovery storageKey={storageKey} language={props.language}>
      <AuthorizedStudio {...props} />
    </StorageRecovery>
  );
}
function AuthorizedStudio({
  user,
  language,
  assistantService,
}: StudioAppProps) {
  const [seed] = useState(() =>
    studioSeed(Date.now(), user.displayName || "WILO", language),
  );
  const key = `wilo-admin-studio-v1/${db?.app.options.projectId || "local"}/${user.uid}`;
  const [repository] = useState(
    () =>
      new StudioRepository(
        new BrowserStudioPersistence(
          key,
          () => auth?.currentUser || null,
          user.uid,
        ),
        () => structuredClone(seed),
        Date.now,
      ),
  );
  const [journal, setJournal] = useState<StudioJournal>(() =>
    repository.read(),
  );
  const [now, setNow] = useState(Date.now),
    [busy, setBusy] = useState(false),
    [editor, setEditor] = useState<EditorRequest | null>(null),
    [searchOpen, setSearchOpen] = useState(false),
    [mobileMenu, setMobileMenu] = useState(false),
    [collapsed, setCollapsed] = useState(false),
    [notice, setNotice] = useState<{ id: number; text: string } | null>(null),
    [assistant, setAssistant] = useState<{ id: number; prompt: string } | null>(
      null,
    ),
    [focus, setFocus] = useState<FocusTarget | null>(() =>
      readFocus(key + "/focus"),
    );
  const current = useRef(journal),
    lock = useRef(false),
    serial = useRef(0),
    mounted = useRef(true);
  const route = useStudioRoute(),
    compact = useCompactLayout(),
    state = journal.current;
  const t = useCallback(
    (word: Parameters<typeof studioWord>[1]) =>
      studioWord(state.settings.language, word),
    [state.settings.language],
  );
  const notify = useCallback(
    (text: string) => setNotice({ id: ++serial.current, text }),
    [],
  );
  const [service] = useState(
    () => assistantService || new PollinationsStudioAssistant(user.uid),
  );
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
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
      .catch(() => notify(studioWord(language, "failed")));
  }, [repository, notify, language]);
  useEffect(
    () =>
      repository.subscribe(() => {
        try {
          const next = repository.read();
          current.current = next;
          setJournal(next);
        } catch {
          notify(t("failed"));
        }
      }),
    [repository, notify, t],
  );
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 7000);
    return () => window.clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    const shortcuts = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", shortcuts);
    return () => window.removeEventListener("keydown", shortcuts);
  }, []);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (lock.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, []);
  const run = useCallback(
    async (command: StudioCommand, revision = current.current.revision) => {
      if (lock.current) return false;
      lock.current = true;
      setBusy(true);
      try {
        const previous = current.current;
        const next = await repository.execute(command, revision);
        if (mounted.current) {
          current.current = next;
          setJournal(next);
          notify(t("saved"));
          if (command.kind === "group")
            navigateStudio({
              screen: "groups",
              scope: command.id,
              item: "",
              query: "",
              filter: "all",
              section: "all",
            });
          if (
            command.kind === "actions" &&
            command.actions.length === 1 &&
            command.actions[0].action === "create"
          ) {
            const action = command.actions[0],
              scope = action.scope || "personal";
            const before =
              action.target === "projects"
                ? previous.current.data.scopes.find((s) => s.id === scope)
                    ?.projects
                : action.target === "sections"
                  ? previous.current.data.scopes.find((s) => s.id === scope)
                      ?.sections
                  : previous.current.data.study[action.target];
            const after =
              action.target === "projects"
                ? next.current.data.scopes.find((s) => s.id === scope)?.projects
                : action.target === "sections"
                  ? next.current.data.scopes.find((s) => s.id === scope)
                      ?.sections
                  : next.current.data.study[action.target];
            const added = after?.find(
              (item) => !before?.some((old) => old.id === item.id),
            );
            if (added) {
              if (action.target === "courses")
                navigateStudio({
                  screen: "university",
                  course: added.id,
                  tab: "overview",
                  item: "",
                  query: "",
                  term: command.semesterId || "current",
                });
              else if (action.target === "tasks" || action.target === "lessons")
                navigateStudio({
                  screen: "university",
                  course: (added as { courseId: string }).courseId,
                  tab: action.target === "tasks" ? "tasks" : "schedule",
                  item: action.target === "tasks" ? added.id : "",
                  query: "",
                });
            }
          }
        }
        return true;
      } catch (error) {
        if (mounted.current) {
          const code = (error as Error).message;
          notify(
            t(
              code === "studio-conflict"
                ? "conflict"
                : code === "studio-missing-checkpoint"
                  ? "noCheckpoint"
                  : code === "studio-permission"
                    ? "permission"
                    : code === "studio-storage-full"
                      ? "storageFull"
                      : "failed",
            ),
          );
        }
        return false;
      } finally {
        lock.current = false;
        if (mounted.current) setBusy(false);
      }
    },
    [repository, notify, t],
  );
  const finishFocus = useCallback(async () => {
    if (!focus) return false;
    const ok = await run({
      kind: "session",
      value: {
        id: createClientId(),
        targetId: focus.id,
        name: focus.name,
        seconds: Math.max(
          1,
          Math.min(86400, Math.floor((Date.now() - focus.startedAt) / 1000)),
        ),
        endedAt: Date.now(),
      },
    });
    if (ok) {
      sessionStorage.removeItem(key + "/focus");
      setFocus(null);
    }
    return ok;
  }, [focus, run, key]);
  const startFocus = useCallback(
    async (id: string, name: string) => {
      if (focus && !(await finishFocus())) return;
      const value = { id, name, startedAt: Date.now() };
      try {
        sessionStorage.setItem(key + "/focus", JSON.stringify(value));
        setFocus(value);
      } catch {
        notify(t("failed"));
      }
    },
    [focus, finishFocus, key, notify, t],
  );
  const context = useMemo(
    () => ({
      uid: user.uid,
      state,
      journal,
      route,
      now,
      busy,
      t,
      run,
      edit: setEditor,
      notify,
      ask: (prompt = "") => setAssistant({ id: ++serial.current, prompt }),
      focus: (id: string, name: string) => {
        void startFocus(id, name);
      },
    }),
    [user.uid, state, journal, route, now, busy, t, run, notify, startFocus],
  );
  if (!isAdmin(user.email, user.emailVerified))
    return <p role="alert">{t("permission")}</p>;
  const blocked = !!assistant && compact;
  const nav = (screen: StudioScreen) => {
    navigateStudio({
      screen,
      course: "",
      item: "",
      tab: "overview",
      scope: "personal",
      query: "",
      filter: "all",
      section: "all",
    });
    setMobileMenu(false);
  };
  const ExitIcon = state.settings.language === "en" ? ArrowLeft : ArrowRight;
  return (
    <StudioContext value={context}>
      <MotionConfig reducedMotion={state.settings.enabled ? "always" : "user"}>
        <div
          className={
            "wilo-studio" +
            (collapsed ? " st-rail-collapsed" : "") +
            (assistant && !compact ? " has-assistant" : "")
          }
          dir={state.settings.language === "en" ? "ltr" : "rtl"}
          data-mode={state.settings.mode}
          data-theme={state.settings.theme}
          data-background={state.settings.background}
          data-quiet={state.settings.enabled}
        >
          <aside className="st-sidebar" inert={blocked}>
            <a className="st-brand" href="#/admin/studio">
              <span className="st-brand-mark">W</span>
              <strong>
                WILO<span>STUDIO</span>
              </strong>
            </a>
            <span className="st-sidebar-caption">{t("preview")}</span>
            <nav aria-label={t("projects")}>
              {screens.map(({ id, Icon }) => (
                <button
                  key={id}
                  className={route.screen === id ? "is-current" : ""}
                  aria-current={route.screen === id ? "page" : undefined}
                  title={t(id)}
                  onClick={() => nav(id)}
                >
                  <Icon size={21} />
                  <span>{t(id)}</span>
                  {route.screen === id && (
                    <motion.span
                      className="st-nav-active"
                      layoutId="studio-nav-active"
                      transition={{
                        type: "spring",
                        stiffness: 420,
                        damping: 35,
                      }}
                    />
                  )}
                </button>
              ))}
            </nav>
            <div className="st-sidebar-bottom">
              <button
                className="st-assistant-entry"
                onClick={() => context.ask()}
              >
                <Sparkles size={20} />
                <span>{t("assistant")}</span>
              </button>
              <button
                onClick={() => setCollapsed(!collapsed)}
                aria-label={collapsed ? t("expand") : t("collapse")}
              >
                {collapsed ? (
                  <ChevronLeft size={19} />
                ) : (
                  <ChevronRight size={19} />
                )}
                <span>{t("collapse")}</span>
              </button>
              <a href="#/admin">
                <ExitIcon size={18} />
                <span>{t("exit")}</span>
              </a>
              <div className="st-sidebar-user">
                <span className="st-avatar">
                  {state.settings.displayName.slice(0, 1)}
                </span>
                <div>
                  <strong dir="auto">{state.settings.displayName}</strong>
                  <small>{t("preview")}</small>
                </div>
                <ShieldCheck size={16} />
              </div>
            </div>
          </aside>
          <div className="st-body">
            <header className="st-topbar" inert={blocked}>
              <div className="st-breadcrumb">
                <strong>WILO</strong>
                <span>/</span>
                <span>{t(route.screen)}</span>
              </div>
              <button
                className="st-global-search"
                onClick={() => setSearchOpen(true)}
              >
                <Search size={18} />
                <span>{t("search")}</span>
                <kbd>⌘ K</kbd>
              </button>
              <div className="st-topbar-actions">
                <button
                  className="st-icon-button"
                  disabled={!journal.undo.length || busy}
                  aria-label={t("undo")}
                  onClick={() => void run({ kind: "undo" })}
                >
                  <Undo2 size={18} />
                </button>
                <button
                  className="st-icon-button"
                  disabled={!journal.redo.length || busy}
                  aria-label={t("redo")}
                  onClick={() => void run({ kind: "redo" })}
                >
                  <Redo2 size={18} />
                </button>
                <StudioExportMenu />
                <details className="st-quick-add">
                  <summary>
                    <Plus size={18} />
                    <span>{t("new")}</span>
                  </summary>
                  <div>
                    <button
                      onClick={() =>
                        setEditor({ kind: "project", scope: "personal" })
                      }
                    >
                      {t("newCard")}
                    </button>
                    <button onClick={() => setEditor({ kind: "course" })}>
                      {t("newCourse")}
                    </button>
                    <button
                      disabled={!state.data.study.courses.length}
                      onClick={() =>
                        setEditor({
                          kind: "task",
                          courseId: route.course || undefined,
                        })
                      }
                    >
                      {t("newTask")}
                    </button>
                  </div>
                </details>
              </div>
            </header>
            <div className="st-preview-strip" inert={blocked}>
              <ShieldCheck size={14} />
              <span>{t("isolated")}</span>
              <a href="#/admin">
                {t("exit")}
                <ExitIcon size={14} />
              </a>
            </div>
            {focus && (
              <FocusClock
                target={focus}
                finish={() => void finishFocus()}
                label={t("stopFocus")}
              />
            )}
            <div className="st-content-row">
              <main className="st-main" inert={blocked} aria-busy={busy}>
                <Suspense
                  fallback={
                    <div
                      className="st-page-skeleton"
                      role="status"
                      aria-label={t("reading")}
                    >
                      <span />
                      <span />
                      <span />
                    </div>
                  }
                >
                  {route.screen === "today" ? (
                    <TodayPage />
                  ) : route.screen === "projects" ||
                    route.screen === "groups" ? (
                    <ProjectsPage key={route.screen + "/" + route.scope} />
                  ) : route.screen === "university" ? (
                    <UniversityPage />
                  ) : route.screen === "library" ? (
                    <LibraryPage />
                  ) : route.screen === "analytics" ? (
                    <AnalyticsPage />
                  ) : (
                    <SettingsPage />
                  )}
                </Suspense>
              </main>
              {assistant && (
                <>
                  {compact && (
                    <button
                      className="st-panel-backdrop"
                      aria-label={t("close")}
                      onClick={() => setAssistant(null)}
                    />
                  )}
                  <StudioAssistantPanel
                    key={assistant.id}
                    service={service}
                    storageKey={key + "/chats"}
                    close={() => setAssistant(null)}
                    initialPrompt={assistant.prompt}
                  />
                </>
              )}
            </div>
          </div>
          <nav
            className="st-mobile-nav"
            aria-label={t("projects")}
            inert={blocked}
          >
            {screens.slice(0, 3).map(({ id, Icon }) => (
              <button
                key={id}
                aria-current={route.screen === id ? "page" : undefined}
                onClick={() => nav(id)}
              >
                <Icon size={21} />
                <span>{t(id)}</span>
              </button>
            ))}
            <button onClick={() => context.ask()}>
              <Sparkles size={21} />
              <span>{t("assistant")}</span>
            </button>
            <button onClick={() => setMobileMenu(true)}>
              <Menu size={21} />
              <span>{t("more")}</span>
            </button>
          </nav>
          {notice && (
            <motion.div
              key={notice.id}
              className="st-toast"
              initial={{ y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
            >
              <Check size={18} />
              <span role="status">{notice.text}</span>
              <button
                className="st-icon-button"
                aria-label={t("dismiss")}
                onClick={() => setNotice(null)}
              >
                <X size={16} />
              </button>
            </motion.div>
          )}
          {editor && (
            <StudioEditor request={editor} close={() => setEditor(null)} />
          )}
          {searchOpen && <SearchPalette close={() => setSearchOpen(false)} />}
          {!editor &&
            route.item &&
            (route.screen === "projects" || route.screen === "groups") && (
              <ProjectDetails />
            )}
          {mobileMenu && (
            <StudioDialog title={t("more")} close={() => setMobileMenu(false)}>
              <div className="st-mobile-menu">
                {screens.slice(3).map(({ id, Icon }) => (
                  <button key={id} onClick={() => nav(id)}>
                    <Icon size={23} />
                    {t(id)}
                  </button>
                ))}
                <a href="#/admin">
                  <ExitIcon size={23} />
                  {t("exit")}
                </a>
              </div>
            </StudioDialog>
          )}
        </div>
      </MotionConfig>
    </StudioContext>
  );
}

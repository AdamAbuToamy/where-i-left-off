import { StudioExportMenu } from "./ExportMenu";
import { useState } from "react";
import {
  ArchiveRestore,
  FileUp,
  Moon,
  Sun,
  ShieldCheck,
  Copy,
  RotateCcw,
  Bookmark,
  Palette,
  Globe,
  Settings2,
} from "lucide-react";
import { themes } from "../../lib/appearanceCatalog";
import { copyAccountIntoStudio } from "../adapters/readAccount";
import { validateStudioState } from "../core/validation";
import { studioSeed } from "../core/seed";
import type { StudioState } from "../core/model";
import type { StudioWord } from "./copy";
import { useStudio } from "./context";
import { StudioDialog } from "./primitives";
export default function StudioSettings() {
  const { state, t, run, uid, notify, journal, now } = useStudio(),
    [copying, setCopying] = useState(false),
    [imported, setImported] = useState<StudioState | null>(null);
  const change = (values: Partial<StudioState["settings"]>) =>
    run({ kind: "settings", values });
  async function copyAccount() {
    const revision = journal.revision;
    setCopying(true);
    try {
      const copied = await copyAccountIntoStudio(uid, state);
      await run({ kind: "replace", state: copied }, revision);
    } catch {
      notify(t("failed"));
    } finally {
      setCopying(false);
    }
  }
  async function readFile(file: File) {
    try {
      if (file.size > 4500000) throw new Error("large");
      const raw: unknown = JSON.parse(await file.text());
      if (
        !raw ||
        typeof raw !== "object" ||
        !("format" in raw) ||
        raw.format !== "wilo-studio-v1" ||
        !("state" in raw)
      )
        throw new Error("invalid");
      setImported(validateStudioState(raw.state));
    } catch {
      notify(t("failed"));
    }
  }
  return (
    <section className="st-settings">
      <header className="st-section-header">
        <div>
          <span className="st-eyebrow">WILO / {t("settings")}</span>
          <h1>{t("settings")}</h1>
        </div>
        <ShieldCheck size={28} />
      </header>
      <div className="st-settings-grid">
        <section className="st-surface">
          <header>
            <Palette size={21} />
            <h2>{t("appearance")}</h2>
          </header>
          <div className="st-mode-picker">
            <button
              aria-pressed={state.settings.mode === "light"}
              onClick={() => void change({ mode: "light" })}
            >
              <Sun size={19} />
              {t("light")}
            </button>
            <button
              aria-pressed={state.settings.mode === "dark"}
              onClick={() => void change({ mode: "dark" })}
            >
              <Moon size={19} />
              {t("dark")}
            </button>
          </div>
          <div className="st-theme-grid">
            {themes.map((theme) => (
              <button
                className={"st-theme-swatch theme-" + theme}
                aria-pressed={state.settings.theme === theme}
                key={theme}
                aria-label={t(theme)}
                onClick={() => void change({ theme })}
              >
                <span />
                <strong>{t(theme)}</strong>
              </button>
            ))}
          </div>
          <label className="st-inline-label">
            {t("background")}
            <select
              value={state.settings.background}
              onChange={(event) =>
                void change({
                  background: event.target
                    .value as StudioState["settings"]["background"],
                })
              }
            >
              {(
                ["plain", "dots", "paper", "grid", "linen", "mist"] as const
              ).map((value) => (
                <option key={value} value={value}>
                  {t(value)}
                </option>
              ))}
            </select>
          </label>
        </section>
        <section className="st-surface">
          <header>
            <Globe size={21} />
            <h2>{t("profile")}</h2>
          </header>
          <form
            className="st-form-stack"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              void change({
                displayName: String(data.get("displayName")).trim(),
              });
            }}
          >
            <label>
              {t("name")}
              <input
                name="displayName"
                key={state.settings.displayName}
                defaultValue={state.settings.displayName}
                required
                maxLength={100}
                dir="auto"
              />
            </label>
            <button className="st-secondary">{t("save")}</button>
          </form>
          <label className="st-form-stack st-setting-language">
            {t("language")}
            <select
              aria-label={t("language")}
              value={state.settings.language}
              onChange={(event) =>
                void change({
                  language: event.target
                    .value as StudioState["settings"]["language"],
                })
              }
            >
              <option value="ar">العربية</option>
              <option value="en">English</option>
              <option value="he">עברית</option>
            </select>
          </label>
        </section>
        <section className="st-surface">
          <header>
            <Settings2 size={21} />
            <h2>{t("workflow")}</h2>
          </header>
          {(["autoArchive", "reminders", "desktop", "enabled"] as const).map(
            (key) => (
              <label className="st-setting-toggle" key={key}>
                <span>
                  {t(
                    (key === "enabled"
                      ? "quiet"
                      : key === "reminders"
                        ? "reminder"
                        : key) as StudioWord,
                  )}
                </span>
                <input
                  type="checkbox"
                  checked={state.settings[key]}
                  onChange={() => void change({ [key]: !state.settings[key] })}
                />
              </label>
            ),
          )}
          <label className="st-inline-label">
            {t("reviewDays")}
            <select
              value={state.settings.reviewDays}
              onChange={(event) =>
                void change({ reviewDays: Number(event.target.value) })
              }
            >
              {[7, 14, 30, 60, 90].map((days) => (
                <option key={days} value={days}>
                  {days}
                </option>
              ))}
            </select>
          </label>
          <p className="st-muted">{t("previewReminders")}</p>
        </section>
        <section className="st-surface st-recovery">
          <header>
            <ArchiveRestore size={22} />
            <h2>{t("recovery")}</h2>
          </header>
          <p>{t("copyHint")}</p>
          <div className="st-recovery-actions">
            <button
              disabled={copying}
              onClick={() => {
                if (window.confirm(t("copyHint"))) void copyAccount();
              }}
            >
              <Copy size={17} />
              {t("copyAccount")}
            </button>
            <button onClick={() => void run({ kind: "checkpoint" })}>
              <Bookmark size={17} />
              {t("checkpointSave")}
            </button>
            <button
              disabled={!journal.checkpoint}
              onClick={() => {
                if (window.confirm(t("resetAsk")))
                  void run({ kind: "restore" });
              }}
            >
              <RotateCcw size={17} />
              {t("checkpointRestore")}
            </button>
            <StudioExportMenu />
            <label className="st-file-button">
              <FileUp size={16} />
              {t("import")}
              <input
                type="file"
                accept=".json,application/json"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void readFile(file);
                  event.target.value = "";
                }}
              />
            </label>
            <button
              onClick={() => {
                if (window.confirm(t("resetAsk")))
                  void run({
                    kind: "replace",
                    state: studioSeed(
                      now,
                      state.settings.displayName,
                      state.settings.language,
                    ),
                  });
              }}
            >
              {t("reset")}
            </button>
            <button
              disabled={!journal.undo.length && !journal.redo.length}
              onClick={() => {
                if (window.confirm(t("clearRecovery")))
                  void run({ kind: "clear-history" });
              }}
            >
              {t("clearRecovery")}
            </button>
          </div>
          <p className="st-muted">{t("exportHint")}</p>
        </section>
      </div>
      {imported && (
        <StudioDialog
          title={t("importConfirm")}
          close={() => setImported(null)}
        >
          <p>
            {imported.data.study.courses.length} {t("myCourses")} ·{" "}
            {imported.data.scopes.reduce(
              (sum, s) => sum + s.projects.length,
              0,
            )}{" "}
            {t("cards")}
          </p>
          <div className="st-dialog-actions">
            <button
              className="st-primary"
              onClick={() =>
                void run({ kind: "replace", state: imported }).then((ok) => {
                  if (ok) setImported(null);
                })
              }
            >
              {t("restore")}
            </button>
            <button className="st-secondary" onClick={() => setImported(null)}>
              {t("cancel")}
            </button>
          </div>
        </StudioDialog>
      )}
    </section>
  );
}

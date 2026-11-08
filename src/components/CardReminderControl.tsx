import { useState, useCallback, useEffect } from "react";
import type { Language } from "../translations";
import { pushCall } from "../lib/pushNotifications";
import type { CardReminder, PushPreferences } from "../lib/pushNotifications";
import {
  normalizeCardSchedule,
  resolveCardSchedule,
} from "../../shared/cardReminderSchedule.mjs";
import type { CardSchedule } from "../../shared/cardReminderSchedule.mjs";
import {
  reminderInput,
  reminderFromInput,
  zonedTime,
  zonedCandidates,
} from "../../shared/reminderTime.mjs";
import { cardReminderWords } from "./cardReminderWords";
import "./CardReminderControl.css";
type View = CardReminder & {
  settingsVersion: string;
  preferences: PushPreferences;
  status: string;
  scheduledAt: string | null;
  effectiveAt: string | null;
  providerAccepted: number;
};
type Props = {
  id: string;
  groupId?: string;
  name: string;
  dueDate?: string;
  language: Language;
  compact?: boolean;
};
export default function CardReminderControl(props: Props) {
  const w = cardReminderWords[props.language],
    [open, setOpen] = useState(false);
  return (
    <details
      className="push-card card-reminder-control"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        <strong dir="auto">{props.compact ? w.title : props.name}</strong>
        <span>{props.compact ? "" : props.dueDate || "—"}</span>
      </summary>
      {open && <ReminderForm {...props} />}
    </details>
  );
}
function ReminderForm({ id, groupId = "", dueDate, language }: Props) {
  const w = cardReminderWords[language],
    [view, setView] = useState<View | null>(null),
    [busy, setBusy] = useState(true),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [mode, setMode] = useState("automatic"),
    [amount, setAmount] = useState(3),
    [unit, setUnit] = useState("days"),
    [time, setTime] = useState("09:00"),
    [date, setDate] = useState(""),
    [zone, setZone] = useState("UTC"),
    [disabled, setDisabled] = useState(false),
    [weekly, setWeekly] = useState(false),
    [dueTime, setDueTime] = useState(""),
    [occurrence, setOccurrence] = useState<"" | "earlier" | "later">("");
  async function load() {
    setBusy(true);
    setError("");
    try {
      accept(
        await pushCall<View>({ action: "card-status", projectId: id, groupId }),
      );
    } catch {
      setError(w.failed);
    } finally {
      setBusy(false);
    }
  }
  const accept = useCallback((next: View) => {
    if (!next.preferences) throw Error("invalid-reminder-response");
    setView(next);
    setDisabled(!!next.disabled);
    setWeekly(!!next.weekly);
    setDueTime(next.time || next.preferences.defaultTime);
    const s = next.schedule;
    setMode(s?.mode || (next.remindAt ? "absolute" : "automatic"));
    setZone(s?.timeZone || next.preferences.timezone);
    if (s?.mode === "relative") {
      setAmount(s.amount);
      setUnit(s.unit);
      setOccurrence(s.disambiguation || "");
      setTime(s.localTime || next.preferences.defaultTime);
      setDueTime(s.dueTime);
    }
    if (s?.mode === "absolute" || next.remindAt)
      setDate(
        reminderInput(
          s?.mode === "absolute" ? s.scheduledAt : next.remindAt,
          s?.timeZone || next.preferences.timezone,
        ),
      );
    else setTime(next.preferences.defaultTime);
  }, []);
  // A mounted editor reads fresh server state once. It never subscribes this browser to Push.
  useEffect(() => {
    let active = true;
    void pushCall<View>({ action: "card-status", projectId: id, groupId })
      .then((next) => {
        if (active) accept(next);
      })
      .catch(() => {
        if (active) setError(w.failed);
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [id, groupId, accept, w.failed]);
  let schedule: CardSchedule | null = null,
    preview: number | null = null;
  if (view)
    try {
      if (mode === "absolute") {
        const at = reminderFromInput(date, zone, occurrence || undefined);
        if (!at) throw Error();
        schedule = normalizeCardSchedule(
          { mode, scheduledAt: at, timeZone: zone },
          view.preferences,
        );
      } else if (mode === "relative")
        schedule = normalizeCardSchedule(
          {
            mode,
            amount,
            unit,
            localTime: ["days", "weeks"].includes(unit) ? time : undefined,
            dueTime,
            timeZone: zone,
            ...(occurrence ? { disambiguation: occurrence } : {}),
          },
          view.preferences,
        );
      if (schedule) preview = resolveCardSchedule(schedule, dueDate);
      else if (dueDate) {
        const at = zonedTime(
          dueDate,
          dueTime || view.preferences.defaultTime,
          view.preferences.timezone,
        );
        preview =
          at === null
            ? null
            : at - (view.leadMinutes ?? view.preferences.leadMinutes) * 60000;
      }
    } catch {
      preview = null;
    }
  let ambiguous = false;
  try {
    if (mode === "absolute" && date)
      ambiguous =
        zonedCandidates(date.slice(0, 10), date.slice(11), zone).length > 1;
    else if (schedule?.mode === "relative") {
      const a = resolveCardSchedule(
          { ...schedule, disambiguation: "earlier" },
          dueDate,
        ),
        b = resolveCardSchedule(
          { ...schedule, disambiguation: "later" },
          dueDate,
        );
      ambiguous = a !== null && b !== null && a !== b;
    }
  } catch {
    /* Invalid zone is shown by the normal validation below. */
  }
  const [now] = useState(() => Date.now());
  const invalid =
    !disabled && mode !== "automatic" && (preview === null || preview <= now);
  async function save(cancel = false) {
    if (!view || busy || (!cancel && invalid)) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await pushCall<View>({
        action: "card",
        projectId: id,
        groupId,
        disabled: cancel ? true : disabled,
        weekly: cancel
          ? view.weekly || false
          : mode === "automatic"
            ? weekly
            : false,
        time: cancel ? view.time || "" : dueTime || "",
        settingsVersion: view.settingsVersion,
        ...(!cancel ? { schedule, leadMinutes: null, remindAt: null } : {}),
      });
      accept(result);
      setMessage(w.saved);
    } catch {
      setError(w.failed);
    } finally {
      setBusy(false);
    }
  }
  if (!view)
    return (
      <div className="card-reminder-editor">
        <p role={error ? "alert" : "status"}>{error || w.loading}</p>
        {error && (
          <button type="button" onClick={() => void load()}>
            {w.refresh}
          </button>
        )}
      </div>
    );
  return (
    <form
      className="card-reminder-editor"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <fieldset disabled={busy}>
        <label className="push-toggle">
          <input
            type="checkbox"
            checked={disabled}
            onChange={(event) => setDisabled(event.target.checked)}
          />
          {w.off}
        </label>
        <label>
          {w.mode}
          <select
            value={mode}
            onChange={(event) => setMode(event.target.value)}
          >
            <option value="automatic">{w.automatic}</option>
            <option value="relative" disabled={!dueDate}>
              {w.relative}
            </option>
            <option value="absolute">{w.absolute}</option>
          </select>
        </label>
        {mode === "relative" && (
          <>
            <div className="card-reminder-grid">
              <label>
                {w.amount}
                <input
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={amount}
                  onChange={(event) => setAmount(Number(event.target.value))}
                />
              </label>
              <label>
                {w.unit}
                <select
                  value={unit}
                  onChange={(event) => setUnit(event.target.value)}
                >
                  {["minutes", "hours", "days", "weeks"].map((value, index) => (
                    <option key={value} value={value}>
                      {w.units[index]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              {["days", "weeks"].includes(unit) ? w.localTime : w.dueTime}
              <input
                type="time"
                required
                value={["days", "weeks"].includes(unit) ? time : dueTime}
                onChange={(event) =>
                  ["days", "weeks"].includes(unit)
                    ? setTime(event.target.value)
                    : setDueTime(event.target.value)
                }
              />
            </label>
            <small>{w.calendarHint}</small>
          </>
        )}
        {mode === "absolute" && (
          <label>
            {w.date}
            <input
              type="datetime-local"
              required
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </label>
        )}
        {mode !== "automatic" && (
          <label>
            {w.zone}
            <input
              required
              value={zone}
              dir="ltr"
              onChange={(event) => setZone(event.target.value)}
            />
          </label>
        )}
        {mode === "automatic" && dueDate && (
          <>
            <label>
              {w.dueTime}
              <input
                type="time"
                value={dueTime}
                onChange={(event) => setDueTime(event.target.value)}
              />
            </label>
            <label className="push-toggle">
              <input
                type="checkbox"
                checked={weekly}
                onChange={(event) => setWeekly(event.target.checked)}
              />
              {language === "ar"
                ? "تكرار أسبوعي"
                : language === "he"
                  ? "חזרה שבועית"
                  : "Repeat weekly"}
            </label>
          </>
        )}
        {ambiguous && (
          <label>
            {language === "ar"
              ? "الساعة تتكرر في هذا اليوم"
              : language === "he"
                ? "השעה חוזרת ביום הזה"
                : "Repeated clock time"}
            <select
              value={occurrence}
              onChange={(event) =>
                setOccurrence(event.target.value as typeof occurrence)
              }
            >
              <option value="">
                {language === "ar"
                  ? "اختر أي مرة"
                  : language === "he"
                    ? "בחרו מופע"
                    : "Choose an occurrence"}
              </option>
              <option value="earlier">
                {language === "ar"
                  ? "المرة الأولى"
                  : language === "he"
                    ? "הפעם הראשונה"
                    : "First occurrence"}
              </option>
              <option value="later">
                {language === "ar"
                  ? "المرة الثانية"
                  : language === "he"
                    ? "הפעם השנייה"
                    : "Second occurrence"}
              </option>
            </select>
          </label>
        )}
        {preview !== null && (
          <output className="card-reminder-preview">
            {w.preview}:{" "}
            <bdi>
              {new Intl.DateTimeFormat(language, {
                timeZone:
                  mode === "automatic" ? view.preferences.timezone : zone,
                dateStyle: "medium",
                timeStyle: "short",
              }).format(preview)}
            </bdi>
            <small dir="ltr">
              {mode === "automatic" ? view.preferences.timezone : zone}
            </small>
          </output>
        )}
        {invalid && <p role="status">{w.invalid}</p>}
        <div className="card-reminder-actions">
          <button type="submit" className="primary-button" disabled={invalid}>
            {w.save}
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => void save(true)}
          >
            {w.cancel}
          </button>
        </div>
      </fieldset>
      <p className="card-reminder-state" role="status">
        {(w.states as Record<string, string>)[view.status] || view.status}
      </p>
      {view.effectiveAt && view.effectiveAt !== view.scheduledAt && (
        <p>
          {language === "ar"
            ? "بعد ساعات الهدوء: "
            : language === "he"
              ? "אחרי שעות השקט: "
              : "After quiet hours: "}
          <bdi>
            {new Date(view.effectiveAt).toLocaleString(language, {
              timeZone: view.preferences.timezone,
            })}
          </bdi>
        </p>
      )}
      <small>{w.hint}</small>
      <button
        type="button"
        className="secondary-button"
        disabled={busy}
        onClick={() => void load()}
      >
        {w.refresh}
      </button>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
    </form>
  );
}

import { Bell, ChevronDown } from "lucide-react";
import { useState, useCallback, useEffect, useRef, useId } from "react";
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
  dueDate?: string;
  configured?: boolean;
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
  initialOpen?: boolean;
  initialEnabled?: boolean;
};
export default function CardReminderControl(props: Props) {
  const w = cardReminderWords[props.language],
    [open, setOpen] = useState(!!props.initialOpen);
  const panelId = useId();
  if (props.compact)
    return (
      <div className="card-reminder-control is-compact">
        <button
          type="button"
          className="primary-button card-reminder-trigger"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
        >
          <Bell size={18} aria-hidden="true" />
          <span>{w.title}</span>
          <ChevronDown
            size={16}
            className={open ? "is-open" : ""}
            aria-hidden="true"
          />
        </button>
        <div id={panelId} hidden={!open}>
          {open && <ReminderList {...props} />}
        </div>
      </div>
    );
  return (
    <details
      className="push-card card-reminder-control"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        <strong dir="auto">{props.compact ? w.title : props.name}</strong>
        <span>{props.compact ? "" : props.dueDate || "—"}</span>
      </summary>
      {open && <ReminderList {...props} />}
    </details>
  );
}
type ReminderItem = Partial<View> & {
  timeZone?: string;
  id: string;
  revision: number | null;
  status: string;
  schedule?: CardSchedule;
  legacy?: boolean;
  settingsVersion?: string;
  state: string;
};
type ReminderCollection = {
  items: ReminderItem[];
  preferences: PushPreferences;
  cardDisabled: boolean;
  settingsVersion: string;
};
function ReminderList(props: Props) {
  const w = cardReminderWords[props.language];
  const [data, setData] = useState<ReminderCollection | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<ReminderItem | "new" | null>(null);
  const [busy, setBusy] = useState(false);
  const [deletion, setDeletion] = useState<{
    id: string;
    requestId: string;
  } | null>(null);
  const reload = useCallback(async () => {
    try {
      const next = await pushCall<ReminderCollection>({
        action: "reminders-list",
        projectId: props.id,
        groupId: props.groupId || "",
      });
      setData(next);
      setError("");
    } catch {
      setError(w.failed);
    }
  }, [props.id, props.groupId, w.failed]);
  useEffect(() => {
    void reload();
  }, [reload]);
  async function toggleCard(disabled: boolean) {
    if (!data) return;
    setBusy(true);
    setError("");
    try {
      await pushCall({
        action: "card",
        projectId: props.id,
        groupId: props.groupId || "",
        disabled,
        settingsVersion: data.settingsVersion,
      });
      await reload();
    } catch {
      setError(w.failed);
    } finally {
      setBusy(false);
    }
  }
  async function cancel(item: ReminderItem) {
    const requestId =
      deletion?.id === item.id ? deletion.requestId : crypto.randomUUID();
    setDeletion({ id: item.id, requestId });
    setBusy(true);
    setError("");
    try {
      setData(
        await pushCall<ReminderCollection>({
          action: "reminder-delete",
          projectId: props.id,
          groupId: props.groupId || "",
          reminderId: item.id,
          requestId,
          body: item.legacy
            ? { expectedSettingsVersion: item.settingsVersion }
            : { expectedRevision: item.revision },
        }),
      );
      setDeletion(null);
    } catch {
      setError(w.failed);
    } finally {
      setBusy(false);
    }
  }
  if (editing)
    return (
      <div>
        <button
          type="button"
          className="secondary-button"
          onClick={() => {
            setEditing(null);
            void reload();
          }}
        >
          {w.back}
        </button>
        <ReminderForm
          {...props}
          record={editing}
          onSaved={() => {
            setEditing(null);
            void reload();
          }}
        />
      </div>
    );
  return (
    <section className="card-reminder-list" aria-label={w.list}>
      <strong>{w.list}</strong>
      {data && (
        <label className="push-toggle">
          <input
            type="checkbox"
            checked={data.cardDisabled}
            disabled={busy}
            onChange={(event) => void toggleCard(event.target.checked)}
          />
          {w.off}
        </label>
      )}
      {!data && !error && <p role="status">{w.loading}</p>}
      {data?.cardDisabled && <p role="status">{w.states.disabled}</p>}
      {data && !data.items.length && <p>{w.states["not-configured"]}</p>}
      {data?.items.map((item) => (
        <article className="card-reminder-item" key={item.id}>
          <strong>
            {item.schedule?.mode === "relative"
              ? w.relative
              : item.schedule?.mode === "absolute"
                ? w.absolute
                : w.automatic}
          </strong>
          {item.scheduledAt && (
            <time dateTime={item.scheduledAt}>
              {new Date(item.scheduledAt).toLocaleString(props.language, {
                timeZone: item.timeZone || data.preferences.timezone,
              })}
            </time>
          )}
          <small dir="ltr">{item.timeZone || data.preferences.timezone}</small>
          {item.effectiveAt && item.effectiveAt !== item.scheduledAt && (
            <small>
              {w.afterQuiet}:{" "}
              {new Date(item.effectiveAt).toLocaleString(props.language, {
                timeZone: item.timeZone || data.preferences.timezone,
              })}
            </small>
          )}
          <p className="card-reminder-state">
            {(w.states as Record<string, string>)[item.status] || item.status}
          </p>
          <div className="card-reminder-actions">
            <button
              className="secondary-button"
              type="button"
              disabled={busy}
              onClick={() => setEditing(item)}
            >
              {w.edit}
            </button>
            <button
              className="secondary-button"
              type="button"
              disabled={busy || item.status === "cancelled"}
              onClick={() => void cancel(item)}
            >
              {w.cancel}
            </button>
          </div>
        </article>
      ))}
      <div className="card-reminder-actions">
        <button
          className="primary-button"
          type="button"
          disabled={!data || busy}
          onClick={() => setEditing("new")}
        >
          {w.add}
        </button>
        <button
          className="secondary-button"
          type="button"
          disabled={busy}
          onClick={() => void reload()}
        >
          {w.refresh}
        </button>
      </div>
      <small>{w.hint}</small>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
function ReminderForm({
  id,
  groupId = "",
  dueDate,
  language,
  initialEnabled = false,
  record,
  onSaved,
}: Props & { record: ReminderItem | "new"; onSaved: () => void }) {
  const requestId = useRef(crypto.randomUUID());
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
  const firstRead = useRef(true);
  const accept = useCallback(
    (next: View) => {
      const draft =
        record === "new" ||
        (firstRead.current &&
          (initialEnabled || (!!groupId && !next.configured)) &&
          !next.schedule &&
          !next.remindAt);
      firstRead.current = false;
      if (!next.preferences) throw Error("invalid-reminder-response");
      setView(next);
      setDisabled(record === "new" || initialEnabled ? false : !!next.disabled);
      setWeekly(!!next.weekly);
      setDueTime(next.time || next.preferences.defaultTime);
      const s = record === "new" ? undefined : record.schedule || next.schedule;
      setMode(
        s?.mode ||
          (record !== "new" && next.remindAt
            ? "absolute"
            : draft
              ? dueDate
                ? "relative"
                : "absolute"
              : dueDate
                ? "relative"
                : "absolute"),
      );
      setZone(s?.timeZone || next.preferences.timezone);
      if (s?.mode === "relative") {
        setAmount(s.amount);
        setUnit(s.unit);
        setOccurrence(s.disambiguation || "");
        setTime(s.localTime || next.preferences.defaultTime);
        setDueTime(s.dueTime);
      }
      if (s?.mode === "absolute" || (record !== "new" && next.remindAt))
        setDate(
          reminderInput(
            s?.mode === "absolute" ? s.scheduledAt : next.remindAt,
            s?.timeZone || next.preferences.timezone,
          ),
        );
      else if (s?.mode !== "relative") setTime(next.preferences.defaultTime);
    },
    [initialEnabled, dueDate, groupId, record],
  );
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
  const cardDueDate = view?.dueDate ?? dueDate;
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
      if (schedule) preview = resolveCardSchedule(schedule, cardDueDate);
      else if (cardDueDate) {
        const at = zonedTime(
          cardDueDate,
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
          cardDueDate,
        ),
        b = resolveCardSchedule(
          { ...schedule, disambiguation: "later" },
          cardDueDate,
        );
      ambiguous = a !== null && b !== null && a !== b;
    }
  } catch {
    /* Invalid zone is shown by the normal validation below. */
  }
  const [now] = useState(() => Date.now());
  const invalid =
    !disabled && mode !== "automatic" && (preview === null || preview <= now);
  async function save() {
    if (!view || busy || invalid) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (!schedule) throw Error("schedule-required");
      await pushCall<ReminderCollection>({
        action: record === "new" ? "reminder-create" : "reminder-update",
        projectId: id,
        groupId,
        reminderId: record === "new" ? undefined : record.id,
        requestId: requestId.current,
        body: {
          schedule,
          ...(record === "new"
            ? initialEnabled || view.disabled
              ? {
                  enableCard: true,
                  expectedSettingsVersion: view.settingsVersion,
                }
              : {}
            : record.legacy
              ? { expectedSettingsVersion: record.settingsVersion }
              : { expectedRevision: record.revision }),
        },
      });
      onSaved();
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
        <label>
          {w.mode}
          <select
            value={mode}
            onChange={(event) => setMode(event.target.value)}
          >
            <option value="relative" disabled={!cardDueDate}>
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
        {mode === "automatic" && cardDueDate && (
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
          <button type="button" className="secondary-button" onClick={onSaved}>
            {w.back}
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

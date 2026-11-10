import CardReminderControl from "./CardReminderControl";
import { useInstalledApp } from "../lib/pushNotifications";
import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import type { Language } from "../translations";
import { auth } from "../lib/firebase";
import { useTaskOverview } from "../lib/useTaskOverview";
import { pushText } from "../pushText";
import {
  deviceOptedIn,
  clearPushBinding,
  deviceSubscription,
  disconnectDevice,
  pushCall,
  pushSupported,
  reminderKey,
  subscribeDevice,
} from "../lib/pushNotifications";
import type { PushPreferences, PushState } from "../lib/pushNotifications";
import "./NotificationSettings.css";
function Settings({ user, language }: { user: User; language: Language }) {
  const installed = useInstalledApp();
  const t = pushText[language],
    { entries, ready } = useTaskOverview(user, "Personal", true, true, true);
  const [state, setState] = useState<PushState | null>(null),
    [busy, setBusy] = useState(false),
    [connected, setConnected] = useState(false),
    [message, setMessage] = useState(""),
    [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const loaded = await pushCall<PushState>({ action: "get" }),
          subscription = pushSupported() ? await deviceSubscription() : null;
        if (alive) {
          setState(loaded);
          setConnected(
            deviceOptedIn(user.uid) &&
              !!subscription &&
              loaded.preferences.enabled &&
              Notification.permission === "granted",
          );
        }
      } catch {
        if (alive) {
          setMessage(t.failed);
          setFailed(true);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [user.uid, t.failed]);
  function patch(value: Partial<PushPreferences>) {
    setState((s) =>
      s ? { ...s, preferences: { ...s.preferences, ...value } } : s,
    );
    setMessage("");
  }
  async function run(action: () => Promise<void>, success: string) {
    setBusy(true);
    setMessage("");
    setFailed(false);
    try {
      await action();
      setMessage(success);
    } catch {
      setFailed(true);
      setMessage(
        "Notification" in window && Notification.permission === "denied"
          ? t.denied
          : t.failed,
      );
    } finally {
      setBusy(false);
    }
  }
  if (!state)
    return (
      <section className="push-page page-panel">
        <a href="#/settings">← {t.back}</a>
        <h2>{t.title}</h2>
        <p role={failed ? "alert" : "status"}>{message || t.loading}</p>
      </section>
    );
  const p = state.preferences;
  const savedPreferences = () => ({ ...p, language });
  return (
    <section className="push-page page-panel">
      <a href="#/settings">← {t.back}</a>
      <header>
        <svg
          className="push-icon"
          aria-hidden="true"
          width="36"
          height="36"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" />
          <path d="M10 21h4M12 1v1" />
        </svg>
        <h2>{t.title}</h2>
        <p>{t.intro}</p>
      </header>
      <section className="push-device">
        <strong>{connected ? t.on : t.localOff}</strong>
        {!installed ? (
          <p>
            {language === "ar"
              ? "يمكنك ضبط التذكيرات من هنا لتصل إلى هاتفك المشترك. لتفعيل الإشعارات على هذا الجهاز افتح النسخة المثبتة."
              : language === "he"
                ? "אפשר להגדיר כאן תזכורות לטלפון הרשום. להפעלת התראות במכשיר זה פתחו את הגרסה המותקנת."
                : "Configure reminders here for your subscribed phone. To enable Push on this device, open the installed app."}
          </p>
        ) : !pushSupported() ? (
          <p>{t.unsupported}</p>
        ) : (
          <div className="push-actions">
            <button
              className="primary-button"
              disabled={busy}
              onClick={() =>
                void run(
                  async () => {
                    if (connected) {
                      await disconnectDevice();
                      setConnected(false);
                    } else {
                      await subscribeDevice(state.publicKey, user.uid, true);
                      const next = { ...savedPreferences(), enabled: true };
                      await pushCall({ action: "save", preferences: next });
                      patch(next);
                      setConnected(true);
                    }
                  },
                  connected ? t.off : t.saved,
                )
              }
            >
              {connected ? t.disable : t.enable}
            </button>
            {connected && (
              <button
                className="secondary-button"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    const subscription = await deviceSubscription();
                    if (!subscription) throw new Error("missing-subscription");
                    await pushCall({
                      action: "test",
                      subscription: subscription.toJSON(),
                    });
                  }, t.testSent)
                }
              >
                {t.test}
              </button>
            )}
          </div>
        )}
      </section>
      <form
        className="push-preferences"
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            await pushCall({ action: "save", preferences: savedPreferences() });
          }, t.saved);
        }}
      >
        <fieldset disabled={busy}>
          <legend>{t.title}</legend>
          <label className="push-toggle">
            <input
              type="checkbox"
              checked={p.enabled}
              onChange={(e) => patch({ enabled: e.target.checked })}
            />
            {language === "ar"
              ? "تفعيل التذكيرات للحساب"
              : language === "he"
                ? "הפעלת תזכורות לחשבון"
                : "Enable account reminders"}
          </label>
          <label className="push-toggle">
            <input
              type="checkbox"
              checked={p.due}
              onChange={(e) => patch({ due: e.target.checked })}
            />
            {t.due}
          </label>
          <div className="push-grid">
            <label>
              {t.defaultTime}
              <input
                type="time"
                required
                value={p.defaultTime}
                onChange={(e) => patch({ defaultTime: e.target.value })}
              />
            </label>
            <label>
              {t.lead}
              <select
                value={p.leadMinutes}
                onChange={(e) => patch({ leadMinutes: Number(e.target.value) })}
              >
                {[0, 15, 60, 1440, 4320, 5760].map((n, i) => (
                  <option key={n} value={n}>
                    {t.leads[i] ||
                      (language === "ar"
                        ? `قبل ${n / 1440} أيام`
                        : language === "he"
                          ? `${n / 1440} ימים לפני`
                          : `${n / 1440} days before`)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="push-toggle">
            <input
              type="checkbox"
              checked={p.stale}
              onChange={(e) => patch({ stale: e.target.checked })}
            />
            {t.stale}
          </label>
          <label>
            {t.days}
            <select
              value={p.staleDays}
              onChange={(e) => patch({ staleDays: Number(e.target.value) })}
            >
              {[7, 14, 30, 60, 90].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className="push-toggle">
            <input
              type="checkbox"
              checked={p.quiet}
              onChange={(e) => patch({ quiet: e.target.checked })}
            />
            {t.quiet}
          </label>
          {p.quiet && (
            <div className="push-grid">
              <label>
                {t.from}
                <input
                  type="time"
                  required
                  value={p.quietStart}
                  onChange={(e) => patch({ quietStart: e.target.value })}
                />
              </label>
              <label>
                {t.to}
                <input
                  type="time"
                  required
                  value={p.quietEnd}
                  onChange={(e) => patch({ quietEnd: e.target.value })}
                />
              </label>
            </div>
          )}
          <label className="push-toggle">
            <input
              type="checkbox"
              checked={p.hideContent}
              onChange={(e) => patch({ hideContent: e.target.checked })}
            />
            {t.privacy}
          </label>
          <label>
            {t.zone}
            <input
              dir="ltr"
              required
              value={p.timezone}
              onChange={(event) => patch({ timezone: event.target.value })}
            />
          </label>
          <button className="primary-button">{t.save}</button>
        </fieldset>
      </form>
      {message && (
        <p
          className={`push-feedback ${failed ? "error" : ""}`}
          role={failed ? "alert" : "status"}
        >
          {message}
        </p>
      )}
      <section className="push-cards">
        <h3>{t.cards}</h3>
        <p>{t.cardsHint}</p>
        {!ready && <p role="status">…</p>}
        {ready && !entries.length && <p>{t.empty}</p>}
        {entries.map((e) => (
          <CardReminderControl
            key={reminderKey(e.project.id, e.groupId)}
            id={e.project.id}
            groupId={e.groupId}
            name={e.project.name}
            dueDate={e.project.dueDate}
            language={language}
          />
        ))}
      </section>
      <p className="push-delivery">{t.delivery}</p>
      {p.enabled && (
        <button
          className="text-button"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const next = { ...savedPreferences(), enabled: false };
              await pushCall({ action: "save", preferences: next });
              await clearPushBinding();
              await disconnectDevice();
              patch(next);
              setConnected(false);
            }, t.off)
          }
        >
          {t.allOff}
        </button>
      )}
    </section>
  );
}
export default function NotificationSettings(props: {
  user: User;
  language: Language;
}) {
  // Direct navigation cannot expose notification controls in ordinary browser tabs.
  // Authentication is checked independently by the callable service.
  if (!auth?.currentUser || auth.currentUser.uid !== props.user.uid)
    return null;
  return <Settings {...props} />;
}

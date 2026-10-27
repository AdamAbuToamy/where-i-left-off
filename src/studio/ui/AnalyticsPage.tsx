import { useState } from "react";
import { Clock3, CheckCheck, TrendingUp } from "lucide-react";
import { studioStats } from "../core/selectors";
import { localDateKey } from "../../lib/projects";
import { useStudio } from "./context";
import { EmptyState } from "./primitives";
export default function StudioAnalytics() {
  const { state, now, t } = useStudio(),
    stats = studioStats(state, now),
    [day, setDay] = useState("");
  const sessions = state.sessions
    .filter((s) => !day || localDateKey(new Date(s.endedAt)) === day)
    .sort((a, b) => b.endedAt - a.endedAt)
    .slice(0, 30);
  const max = Math.max(1, ...stats.days.map((d) => d.seconds));
  return (
    <section className="st-analytics">
      <header className="st-section-header">
        <div>
          <span className="st-eyebrow">WILO / {t("analytics")}</span>
          <h1>{t("weeklyActivity")}</h1>
        </div>
        <TrendingUp size={28} />
      </header>
      <div className="st-metrics">
        <article>
          <Clock3 size={20} />
          <strong>{(stats.seconds / 3600).toFixed(1)}</strong>
          <span>
            {t("hours")} / {t("week")}
          </span>
        </article>
        <article>
          <CheckCheck size={20} />
          <strong>{stats.completed}</strong>
          <span>{t("done")}</span>
        </article>
        <article>
          <TrendingUp size={20} />
          <strong>{stats.open}</strong>
          <span>{t("tasks")}</span>
        </article>
      </div>
      <div className="st-analytics-grid">
        <section className="st-surface">
          <header className="st-section-header">
            <h2>{t("week")}</h2>
            <button className="st-link-button" onClick={() => setDay("")}>
              {t("all")}
            </button>
          </header>
          <div
            className="st-week-chart"
            role="group"
            aria-label={t("weeklyActivity")}
          >
            {stats.days.map((d) => (
              <button
                aria-pressed={day === d.date}
                key={d.date}
                onClick={() => setDay(day === d.date ? "" : d.date)}
                aria-label={
                  d.date +
                  " · " +
                  Math.round(d.seconds / 60) +
                  " " +
                  t("minutes")
                }
              >
                <span className="st-chart-value">
                  {Math.round(d.seconds / 60)}
                </span>
                <span className="st-chart-track">
                  <span
                    style={{
                      height: Math.max(3, (d.seconds / max) * 100) + "%",
                    }}
                  />
                </span>
                <span>
                  {new Intl.DateTimeFormat(state.settings.language, {
                    weekday: "short",
                  }).format(new Date(d.date + "T12:00:00"))}
                </span>
              </button>
            ))}
          </div>
        </section>
        <section className="st-surface">
          <h2>{t("byTarget")}</h2>
          {stats.byTarget.map((item) => (
            <div className="st-time-distribution" key={item.id}>
              <div>
                <strong dir="auto">{item.name}</strong>
                <span>
                  {Math.round(item.seconds / 60)} {t("minutes")}
                </span>
              </div>
              <progress
                max={Math.max(1, ...stats.byTarget.map((v) => v.seconds))}
                value={item.seconds}
                aria-label={item.name}
              />
            </div>
          ))}
          {!stats.byTarget.length && (
            <p className="st-muted">{t("noSessions")}</p>
          )}
        </section>
      </div>
      <section className="st-section">
        <h2>
          {t("history")}
          {day ? " · " + day : ""}
        </h2>
        {sessions.map((session) => (
          <article className="st-session-row" key={session.id}>
            <Clock3 size={18} />
            <strong dir="auto">{session.name}</strong>
            <time>
              {new Date(session.endedAt).toLocaleString(
                state.settings.language,
              )}
            </time>
            <span>
              {Math.round(session.seconds / 60)} {t("minutes")}
            </span>
          </article>
        ))}
        {!sessions.length && <EmptyState title={t("noSessions")} />}
      </section>
    </section>
  );
}

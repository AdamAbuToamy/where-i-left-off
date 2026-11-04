import type { User } from "firebase/auth";
import type { Language } from "../translations";
import type { Project } from "../types";
import { currentCard } from "../lib/workflow";
import { localDateKey } from "../lib/projects";
import { useSessionHistory } from "../lib/sessionJournal";
import FocusSession from "../components/FocusSession";
import LinkedText from "../components/LinkedText";
import StudyToday from "../university/StudyToday";
import { useExperience } from "./context";
import { cardKey } from "./state";
import { prioritize, dailyCards } from "./priorities";
import { label, useFeatureAction } from "./helpers";
import { FeatureStatus, Panel } from "./ui";
export default function ResumePanel({
  user,
  language,
  inHub = false,
}: {
  user: User;
  language: Language;
  inHub?: boolean;
}) {
  const context = useExperience()!,
    action = useFeatureAction(language),
    t = (ar: string, en: string) => label(language, ar, en),
    today = localDateKey(),
    { items: sessions } = useSessionHistory(user.uid);
  const cards = (context.cards?.projects || []).filter(
      (p) => currentCard(p) && p.status !== "done",
    ),
    keys = dailyCards(
      context.view.state,
      today,
      new Set(cards.map((p) => cardKey(p.id))),
    ),
    chosen = keys.flatMap((key) => cards.filter((p) => cardKey(p.id) === key));
  const last = sessions.find(
      (s) => !s.groupId && cards.some((p) => p.id === s.projectId),
    ),
    lastCard = last ? cards.find((p) => p.id === last.projectId) : undefined;
  function row(project: Project) {
    return (
      <article className="pilot-resume-card" key={project.id}>
        <h3 dir="auto">{project.name}</h3>
        {project.checkpoint && (
          <p>
            <strong>{t("توقفت عند: ", "Stopped at: ")}</strong>
            <LinkedText text={project.checkpoint} />
          </p>
        )}
        <p>
          <strong>{t("الخطوة القادمة: ", "Next step: ")}</strong>
          <LinkedText
            text={
              project.nextStep ||
              t("حدد خطوة صغيرة للبدء.", "Choose a small next step.")
            }
          />
        </p>
        <div className="pilot-inline">
          <a className="secondary-button" href={"#/personal/" + project.id}>
            {t("فتح البطاقة", "Open card")}
          </a>
          {context.workspace && (
            <FocusSession
              project={project}
              user={user}
              language={language}
              onSave={async (details, revision) => {
                try {
                  await context.workspace!.change(
                    { ...project, revision },
                    "edit",
                    details,
                  );
                  return true;
                } catch {
                  return false;
                }
              }}
            />
          )}
        </div>
        <details>
          <summary>{t("روابط العمل", "Work links")}</summary>
          {[project.projectUrl, project.attachmentUrl, ...(project.links || [])]
            .filter(
              (value, index, all): value is string =>
                !!value && all.indexOf(value) === index,
            )
            .map((url) => (
              <a
                className="pilot-resource"
                key={url}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {new URL(url).hostname} ↗
              </a>
            ))}
        </details>
      </article>
    );
  }
  return (
    <Panel title={t("أكمل من حيث توقفت", "Pick up where you left off")}>
      <FeatureStatus {...action} />
      {lastCard && (
        <section className="pilot-last">
          <small>{t("آخر جلسة محفوظة", "Last saved session")}</small>
          {row(lastCard)}
        </section>
      )}
      <h3>{t("أهم ثلاث مهام اليوم", "Today’s top three")}</h3>
      <div className="pilot-grid">{chosen.map(row)}</div>
      {!chosen.length && (
        <p>
          {t(
            "اختر ما تريد إنجازه اليوم؛ أنت تقرر الأولوية.",
            "Choose what matters today. You decide the priorities.",
          )}
        </p>
      )}
      <details>
        <summary>
          {t("اختيار أولويات اليوم", "Choose today’s priorities")} ·{" "}
          {keys.length}/3
        </summary>
        <div className="pilot-choice-list">
          {cards.map((project) => (
            <label key={project.id}>
              <input
                type="checkbox"
                checked={keys.includes(cardKey(project.id))}
                disabled={
                  !keys.includes(cardKey(project.id)) && keys.length >= 3
                }
                onChange={() =>
                  void action.run(() =>
                    context.change((state) =>
                      prioritize(state, cardKey(project.id), today),
                    ),
                  )
                }
              />
              <span dir="auto">{project.name}</span>
            </label>
          ))}
        </div>
      </details>
      <details>
        <summary>
          {t("بانتظار رد أو متابعة", "Waiting for a reply or follow-up")} (
          {cards.filter((p) => p.status === "waiting").length})
        </summary>
        {cards
          .filter((p) => p.status === "waiting")
          .map((p) => (
            <p key={p.id}>
              <a href={"#/personal/" + p.id}>{p.name}</a>
              {p.followUpDate && <time> · {p.followUpDate}</time>}
            </p>
          ))}
      </details>
      {!inHub && user.emailVerified && (
        <StudyToday user={user} language={language} />
      )}
    </Panel>
  );
}

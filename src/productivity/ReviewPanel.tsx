import { useState } from "react";
import type { Language } from "../translations";
import { currentCard } from "../lib/workflow";
import { localDateKey } from "../lib/projects";
import { useExperience } from "./context";
import { cardKey } from "./state";
import { reviewCandidates, reviewLater } from "./review";
import CardPicker from "./CardPicker";
import { Panel, FeatureStatus } from "./ui";
import { label, useFeatureAction, useFeatureNow } from "./helpers";
export default function ReviewPanel({
  language,
  selected = "",
}: {
  language: Language;
  selected?: string;
}) {
  const context = useExperience()!,
    t = (a: string, e: string) => label(language, a, e),
    action = useFeatureAction(language),
    [all, setAll] = useState(false),
    [draft, setDraft] = useState(() => {
      const p = context.cards?.projects.find((p) => cardKey(p.id) === selected);
      return {
        key: selected,
        date: p?.followUpDate || "",
        revision: p?.revision ?? -1,
      };
    }),
    today = localDateKey(),
    now = useFeatureNow(),
    cards = (context.cards?.projects || []).filter(currentCard),
    rows = all
      ? cards.filter((p) => p.status !== "done")
      : reviewCandidates(cards, context.view.state, today, now),
    nextWeek = localDateKey(new Date(now + 7 * 86400000));
  return (
    <Panel title={t("المتابعة والمراجعة", "Follow-up & review")}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void action.run(
            async () => {
              const project = cards.find((p) => cardKey(p.id) === draft.key);
              if (!project || project.revision !== draft.revision)
                throw new Error("experience-conflict");
              await context.workspace!.change(project, "edit", {
                followUpDate: draft.date,
              });
              setDraft((d) => ({ ...d, revision: d.revision + 1 }));
            },
            t(
              "تم حفظ موعد المتابعة؛ لم يتغير موعد التسليم.",
              "Follow-up saved; the deadline is unchanged.",
            ),
          );
        }}
      >
        <div className="pilot-grid">
          <CardPicker
            language={language}
            value={draft.key}
            title={t("بطاقة للمتابعة", "Card to follow up")}
            onChange={(key) => {
              const p = cards.find((p) => cardKey(p.id) === key);
              setDraft({
                key,
                date: p?.followUpDate || "",
                revision: p?.revision ?? -1,
              });
            }}
          />
          <label>
            {t("تاريخ المتابعة", "Follow-up date")}
            <input
              type="date"
              value={draft.date}
              onChange={(e) =>
                setDraft((d) => ({ ...d, date: e.target.value }))
              }
            />
          </label>
        </div>
        <button
          className="primary-button"
          disabled={!draft.key || !context.workspace || action.busy}
        >
          {t("حفظ المتابعة", "Save follow-up")}
        </button>
      </form>
      <FeatureStatus {...action} />
      <div className="pilot-inline">
        <h3>{t("مراجعة أسبوعية", "Weekly review")}</h3>
        <button aria-pressed={all} onClick={() => setAll((v) => !v)}>
          {all
            ? t("التي تحتاج مراجعة فقط", "Show review candidates")
            : t("مراجعة كل البطاقات", "Review all cards")}
        </button>
      </div>
      <div className="pilot-list">
        {rows.map((p) => (
          <article key={p.id}>
            <div>
              <strong>{p.name}</strong>
              <span>
                {p.followUpDate && p.followUpDate <= today
                  ? t("حان وقت المتابعة", "Follow-up is due")
                  : t("راجع الخطوة القادمة", "Review the next step")}
              </span>
            </div>
            <div className="pilot-inline">
              <a href={"#/personal/" + p.id}>{t("أكمل", "Continue")} ↗</a>
              <button
                onClick={() =>
                  void action.run(() =>
                    context.change((state) =>
                      reviewLater(state, cardKey(p.id), nextWeek, Date.now()),
                    ),
                  )
                }
              >
                {t("راجعها الأسبوع القادم", "Review next week")}
              </button>
              <button
                disabled={!context.workspace}
                onClick={() =>
                  void action.run(async () => {
                    await context.workspace!.change(p, "edit", {
                      archivedAt: Date.now(),
                    });
                  })
                }
              >
                {t("أرشفة", "Archive")}
              </button>
            </div>
          </article>
        ))}
      </div>
      {!rows.length && (
        <p>
          {t(
            "لا توجد بطاقات تحتاج مراجعة الآن.",
            "No cards need a review right now.",
          )}
        </p>
      )}
    </Panel>
  );
}

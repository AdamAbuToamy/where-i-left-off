import { useState } from "react";
import type { Language } from "../translations";
import { localDateKey } from "../lib/projects";
import { currentCard } from "../lib/workflow";
import { toLocalInput } from "../university/state";
import { createClientId } from "../lib/clientId";
import { useExperience } from "./context";
import { cardKey } from "./state";
import type { TimeBlock } from "./state";
import { schedulingConflicts, schedule } from "./scheduling";
import { useStudySnapshot } from "./useStudySnapshot";
import CardPicker from "./CardPicker";
import { label, useFeatureAction } from "./helpers";
import { Panel, FeatureStatus } from "./ui";
export default function SchedulePanel({
  language,
  selected = "",
}: {
  language: Language;
  selected?: string;
}) {
  const context = useExperience()!,
    study = useStudySnapshot(context.uid),
    [card, setCard] = useState(selected),
    [start, setStart] = useState(localDateKey() + "T09:00"),
    [minutes, setMinutes] = useState(30),
    [offset, setOffset] = useState(0),
    [review, setReview] = useState<{
      block: TimeBlock;
      conflicts: string[];
      baseline: string;
    } | null>(null),
    action = useFeatureAction(language),
    t = (a: string, e: string) => label(language, a, e),
    zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const cards = (context.cards?.projects || []).filter(currentCard),
    names = new Map(cards.map((p) => [cardKey(p.id), p.name])),
    today = new Date(),
    sunday = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() - today.getDay() + offset * 7,
    ),
    days = Array.from(
      { length: 7 },
      (_, i) =>
        new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate() + i),
    );
  function commit(block: TimeBlock, allowed = false) {
    context.change((state) =>
      schedule(state, block, study.state.lessons, zone, allowed),
    );
    setReview(null);
  }
  function prepare() {
    const date = new Date(start);
    if (
      !names.has(card) ||
      !Number.isFinite(date.getTime()) ||
      toLocalInput(date.toISOString()) !== start
    )
      throw new Error("experience-invalid");
    const block = {
      id: createClientId(),
      card,
      start: date.toISOString(),
      minutes,
    };
    const conflicts = schedulingConflicts(
      block,
      context.repository.state.blocks,
      study.state.lessons,
      zone,
    );
    if (conflicts.length)
      setReview({
        block,
        conflicts,
        baseline: JSON.stringify([
          context.repository.state.blocks,
          study.state.lessons,
        ]),
      });
    else commit(block);
  }
  const selectedCard = cards.find((p) => cardKey(p.id) === card);
  return (
    <Panel title={t("وقت العمل", "Work time")}>
      <p className="pilot-muted">
        {t(
          "وقت العمل منفصل عن موعد تسليم البطاقة.",
          "Work time is separate from the card’s deadline.",
        )}{" "}
        · {zone}
      </p>
      <form
        onChange={() => setReview(null)}
        onSubmit={(e) => {
          e.preventDefault();
          void action.run(prepare);
        }}
      >
        <div className="pilot-grid">
          <CardPicker
            value={card}
            onChange={(value) => {
              setCard(value);
              setMinutes(
                context.view.state.estimates.find((e) => e.id === value)
                  ?.minutes || 30,
              );
              setReview(null);
            }}
            title={t("البطاقة", "Card")}
            language={language}
          />
          <label>
            {t("وقت البدء", "Start time")}
            <input
              type="datetime-local"
              required
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          <label>
            {t("المدة بالدقائق", "Duration in minutes")}
            <input
              type="number"
              min={5}
              max={1440}
              step={5}
              required
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
            />
          </label>
        </div>
        {selectedCard?.dueDate && (
          <p>
            {t("موعد التسليم: ", "Deadline: ")}
            {selectedCard.dueDate}
          </p>
        )}
        <div className="pilot-inline">
          <button
            className="primary-button"
            disabled={
              !card || action.busy || !study.status.ready || !!study.error
            }
          >
            {t("تخصيص وقت", "Schedule work")}
          </button>
          <button
            type="button"
            disabled={!card}
            onClick={() =>
              void action.run(() =>
                context.change((state) => ({
                  ...state,
                  estimates: [
                    ...state.estimates.filter((e) => e.id !== card),
                    { id: card, minutes },
                  ],
                })),
              )
            }
          >
            {t("حفظ المدة كتقدير للبطاقة", "Save card time estimate")}
          </button>
        </div>
        {(!study.status.ready || study.error) && (
          <p>
            {t(
              "بانتظار جدول الجامعة لفحص التعارضات.",
              "Waiting for the university timetable to check conflicts.",
            )}
          </p>
        )}
      </form>
      <FeatureStatus {...action} />
      {review && (
        <section className="pilot-warning" role="alert">
          <p>
            {t(
              "يوجد تعارض مع وقت عمل أو محاضرة.",
              "This overlaps a work block or class.",
            )}
          </p>
          <ul>
            {review.conflicts.map((id) => (
              <li key={id}>
                {id.startsWith("block:")
                  ? names.get(
                      context.view.state.blocks.find(
                        (b) => b.id === id.slice(6),
                      )?.card || "",
                    ) || t("وقت عمل آخر", "Another work block")
                  : study.state.courses.find(
                      (c) =>
                        c.id ===
                        study.state.lessons.find((l) => l.id === id.slice(7))
                          ?.courseId,
                    )?.name || t("محاضرة", "Class")}
              </li>
            ))}
          </ul>
          <button
            onClick={() =>
              void action.run(() => {
                if (
                  review.baseline !==
                  JSON.stringify([
                    context.repository.state.blocks,
                    study.state.lessons,
                  ])
                ) {
                  setReview(null);
                  throw new Error("experience-conflict");
                }
                commit(review.block, true);
              })
            }
          >
            {t("حفظ رغم التعارض", "Save despite overlap")}
          </button>
          <button onClick={() => setReview(null)}>
            {t("تعديل", "Adjust")}
          </button>
        </section>
      )}
      <div className="pilot-inline">
        <button onClick={() => setOffset((v) => v - 1)}>←</button>
        <strong>
          {localDateKey(days[0])} — {localDateKey(days[6])}
        </strong>
        <button onClick={() => setOffset((v) => v + 1)}>→</button>
      </div>
      <div className="pilot-calendar">
        {days.map((day) => (
          <section
            key={localDateKey(day)}
            className="pilot-calendar-day"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const key = e.dataTransfer.getData("application/x-wilo-card");
              if (names.has(key)) {
                setCard(key);
                setStart(localDateKey(day) + "T09:00");
                setReview(null);
              }
            }}
          >
            <h3>
              {day.toLocaleDateString(language, {
                weekday: "short",
                day: "numeric",
                month: "numeric",
              })}
            </h3>
            {context.view.state.blocks
              .filter(
                (b) => localDateKey(new Date(b.start)) === localDateKey(day),
              )
              .map((b) => (
                <article key={b.id}>
                  <strong>
                    {names.get(b.card) ||
                      t("بطاقة غير متاحة", "Unavailable card")}
                  </strong>
                  <small>
                    {new Date(b.start).toLocaleTimeString(language, {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    · {b.minutes} {t("دقيقة", "min")}
                  </small>
                  <button
                    onClick={() =>
                      void action.run(() =>
                        context.change((state) => ({
                          ...state,
                          blocks: state.blocks.filter(
                            (item) => item.id !== b.id,
                          ),
                        })),
                      )
                    }
                  >
                    {t("إلغاء الوقت", "Remove block")}
                  </button>
                </article>
              ))}
          </section>
        ))}
      </div>
      <details>
        <summary>
          {t(
            "اسحب بطاقة إلى يوم أو اخترها من النموذج",
            "Drag a card to a day, or use the form",
          )}
        </summary>
        <div className="pilot-inline">
          {cards.map((p) => (
            <button
              draggable
              onDragStart={(e) =>
                e.dataTransfer.setData("application/x-wilo-card", cardKey(p.id))
              }
              key={p.id}
              onClick={() => setCard(cardKey(p.id))}
            >
              {p.name}
            </button>
          ))}
        </div>
      </details>
    </Panel>
  );
}

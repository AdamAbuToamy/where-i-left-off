import { useState } from "react";
import type { Language } from "../translations";
import ChoicePicker from "../components/ChoicePicker";
import { createClientId } from "../lib/clientId";
import { localDateKey } from "../lib/projects";
import { currentCard } from "../lib/workflow";
import { useExperience } from "./context";
import { cardKey } from "./state";
import type { RepeatRule } from "./state";
import {
  builtinTemplates,
  templateFromCard,
  occurrence,
  advanceRepeat,
} from "./templates";
import CardPicker from "./CardPicker";
import { Panel, FeatureStatus } from "./ui";
import { label, useFeatureAction } from "./helpers";
export default function TemplatesPanel({
  language,
  selected = "",
}: {
  language: Language;
  selected?: string;
}) {
  const context = useExperience()!,
    t = (a: string, e: string) => label(language, a, e),
    action = useFeatureAction(language),
    [templateId, setTemplateId] = useState("builtin_project"),
    [name, setName] = useState(""),
    [draftId, setDraftId] = useState(createClientId),
    [source, setSource] = useState(selected),
    [title, setTitle] = useState(""),
    [frequency, setFrequency] = useState<RepeatRule["frequency"]>("weekly"),
    [next, setNext] = useState(localDateKey),
    [automatic, setAutomatic] = useState(false),
    templates = [
      ...builtinTemplates(language === "ar"),
      ...context.view.state.templates,
    ],
    template = templates.find((t) => t.id === templateId) || templates[0],
    cards = (context.cards?.projects || []).filter(currentCard);
  return (
    <Panel title={t("قوالب ومهام متكررة", "Templates & recurring cards")}>
      <FeatureStatus {...action} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void action.run(
            async () => {
              await context.workspace!.addOnce(
                draftId,
                name.trim(),
                template.nextStep,
                (context.cards?.projects[0]?.rank || 1024) - 1024,
                {
                  checklist: template.checklist,
                  description: template.description,
                  status: "later",
                },
              );
              setName("");
              setDraftId(createClientId());
            },
            t(
              "أُضيفت البطاقة من القالب؛ راقب المزامنة.",
              "Card created from template; check sync status.",
            ),
          );
        }}
      >
        <ChoicePicker
          label={t("القالب", "Template")}
          value={template.id}
          onChange={setTemplateId}
          options={templates.map((t) => ({ value: t.id, label: t.title }))}
        />
        <label>
          {t("اسم البطاقة الجديدة", "New card name")}
          <input
            required
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <details>
          <summary>{t("تفاصيل القالب", "Template details")}</summary>
          <p>{template.nextStep}</p>
          <pre>{template.checklist}</pre>
        </details>
        <button
          className="primary-button"
          disabled={!name.trim() || !context.workspace || action.busy}
        >
          {t("إنشاء من القالب", "Create from template")}
        </button>
      </form>
      <details>
        <summary>{t("حفظ قالب من بطاقة", "Save a card as a template")}</summary>
        <CardPicker
          language={language}
          title={t("البطاقة الأصلية", "Source card")}
          value={source}
          onChange={setSource}
        />
        <label>
          {t("اسم القالب", "Template name")}
          <input
            maxLength={100}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <button
          disabled={!source || !title.trim()}
          onClick={() =>
            void action.run(() => {
              const project = cards.find((p) => cardKey(p.id) === source);
              if (!project) throw new Error("experience-missing");
              context.change((state) => ({
                ...state,
                templates: [
                  ...state.templates,
                  templateFromCard(project, createClientId(), title.trim()),
                ],
              }));
              setTitle("");
            })
          }
        >
          {t("حفظ القالب", "Save template")}
        </button>
        {context.view.state.templates.map((template) => (
          <p key={template.id}>
            {template.title}{" "}
            <button
              onClick={() =>
                void action.run(() =>
                  context.change((state) => ({
                    ...state,
                    templates: state.templates.filter(
                      (t) => t.id !== template.id,
                    ),
                  })),
                )
              }
            >
              {t("إزالة القالب", "Remove template")}
            </button>
          </p>
        ))}
      </details>
      <details>
        <summary>{t("تكرار بطاقة", "Repeat a card")}</summary>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void action.run(() => {
              context.change((state) => ({
                ...state,
                repeat: [
                  ...state.repeat,
                  {
                    id: createClientId(),
                    card: source,
                    frequency,
                    next,
                    anchor: Number(next.slice(8)),
                    lastOccurrence: "",
                    enabled: true,
                    automatic,
                  },
                ],
              }));
            });
          }}
        >
          <CardPicker
            language={language}
            title={t("بطاقة التكرار", "Recurring card")}
            value={source}
            onChange={setSource}
          />
          <div className="pilot-grid">
            <label>
              {t("التكرار", "Frequency")}
              <ChoicePicker
                label={t("التكرار", "Frequency")}
                value={frequency}
                onChange={(value) =>
                  setFrequency(value as RepeatRule["frequency"])
                }
                options={[
                  { value: "daily", label: t("يومي", "Daily") },
                  { value: "weekly", label: t("أسبوعي", "Weekly") },
                  { value: "monthly", label: t("شهري", "Monthly") },
                ]}
              />
            </label>
            <label>
              {t("الموعد القادم", "Next occurrence")}
              <input
                type="date"
                required
                value={next}
                onChange={(e) => setNext(e.target.value)}
              />
            </label>
          </div>
          <label className="pilot-checkbox">
            <input
              type="checkbox"
              checked={automatic}
              onChange={(e) => setAutomatic(e.target.checked)}
            />
            {t(
              "أنشئ أحدث موعد مستحق عند فتح الموقع",
              "Create the latest due occurrence when opening the app",
            )}
          </label>
          <small>
            {t(
              "التلقائي يتجاوز المواعيد الفائتة الأقدم. يمكنك إنشاء الموعد المعروض يدويًا بدلًا منه.",
              "Automatic mode skips older missed dates. You can create the displayed occurrence manually instead.",
            )}
          </small>
          <button disabled={!source || action.busy} className="primary-button">
            {t("حفظ التكرار", "Save recurrence")}
          </button>
        </form>
      </details>
      <div className="pilot-list">
        {context.view.state.repeat.map((rule) => {
          const sourceCard = cards.find((p) => cardKey(p.id) === rule.card);
          return (
            <article key={rule.id}>
              <div>
                <strong>
                  {sourceCard?.name || t("بطاقة غير متاحة", "Unavailable card")}
                </strong>
                <span>
                  {rule.next} · {rule.frequency} ·{" "}
                  {rule.automatic
                    ? t("تلقائي", "Automatic")
                    : t("يدوي", "Manual")}
                </span>
              </div>
              <div className="pilot-inline">
                <button
                  disabled={
                    !sourceCard ||
                    !rule.enabled ||
                    !context.workspace ||
                    action.busy
                  }
                  onClick={() =>
                    void action.run(
                      async () => {
                        const card = occurrence(rule, sourceCard!);
                        await context.workspace!.addOnce(
                          card.id,
                          card.name,
                          card.nextStep,
                          (context.cards?.projects[0]?.rank || 1024) - 1024,
                          card.details,
                        );
                        context.change((state) =>
                          advanceRepeat(state, rule, rule.next),
                        );
                      },
                      t(
                        "أُضيف الموعد مرة واحدة؛ راقب المزامنة.",
                        "Occurrence added once; check sync status.",
                      ),
                    )
                  }
                >
                  {t("إنشاء الموعد المعروض", "Create displayed occurrence")}
                </button>
                <button
                  onClick={() =>
                    void action.run(() =>
                      context.change((state) => ({
                        ...state,
                        repeat: state.repeat.map((r) =>
                          r.id === rule.id ? { ...r, enabled: !r.enabled } : r,
                        ),
                      })),
                    )
                  }
                >
                  {rule.enabled ? t("إيقاف", "Pause") : t("استئناف", "Resume")}
                </button>
                <button
                  onClick={() =>
                    void action.run(() =>
                      context.change((state) => ({
                        ...state,
                        repeat: state.repeat.filter((r) => r.id !== rule.id),
                      })),
                    )
                  }
                >
                  {t("إزالة القاعدة", "Remove rule")}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </Panel>
  );
}

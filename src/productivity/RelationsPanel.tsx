import { useState } from "react";
import type { Language } from "../translations";
import ChoicePicker from "../components/ChoicePicker";
import { createClientId } from "../lib/clientId";
import { useExperience } from "./context";
import { cardKey } from "./state";
import type { Relation } from "./state";
import { relate, blockers } from "./relations";
import CardPicker from "./CardPicker";
import { label, useFeatureAction } from "./helpers";
import { FeatureStatus, Panel } from "./ui";
export default function RelationsPanel({
  language,
  selected = "",
}: {
  language: Language;
  selected?: string;
}) {
  const context = useExperience()!,
    [source, setSource] = useState(selected),
    [target, setTarget] = useState(""),
    [kind, setKind] = useState<Relation["kind"]>("related"),
    action = useFeatureAction(language),
    t = (a: string, e: string) => label(language, a, e),
    cards = context.cards?.projects || [],
    names = new Map(cards.map((p) => [cardKey(p.id), p.name])),
    status = new Map(cards.map((p) => [cardKey(p.id), p.status])),
    kinds = {
      related: t("مرتبط بـ", "Related to"),
      part: t("جزء من", "Part of"),
      depends: t("يتوقف على", "Depends on"),
    };
  return (
    <Panel title={t("علاقات البطاقات", "Card relationships")}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void action.run(() =>
            context.change((state) =>
              relate(
                state,
                { id: createClientId(), source, target, kind },
                new Set(names.keys()),
              ),
            ),
          );
        }}
      >
        <div className="pilot-grid">
          <CardPicker
            title={t("البطاقة", "Card")}
            value={source}
            onChange={setSource}
            language={language}
          />
          <label>
            {t("نوع العلاقة", "Relationship")}
            <ChoicePicker
              label={t("نوع العلاقة", "Relationship")}
              value={kind}
              onChange={(v) => setKind(v as Relation["kind"])}
              options={Object.entries(kinds).map(([value, label]) => ({
                value,
                label,
              }))}
            />
          </label>
          <CardPicker
            title={t("البطاقة الأخرى", "Other card")}
            value={target}
            onChange={setTarget}
            language={language}
          />
        </div>
        <button
          disabled={!source || !target || source === target || action.busy}
          className="primary-button"
        >
          {t("إضافة العلاقة", "Add relationship")}
        </button>
      </form>
      <FeatureStatus {...action} />
      {source && blockers(context.view.state, source, status).length > 0 && (
        <p className="pilot-warning">
          {t(
            "تنتظر هذه البطاقة إنجاز متطلبات مرتبطة.",
            "This card is waiting on its dependencies.",
          )}
        </p>
      )}
      <div className="pilot-list">
        {context.view.state.relations
          .filter((r) => !source || r.source === source || r.target === source)
          .map((r) => (
            <article key={r.id}>
              <div>
                <strong>
                  {names.get(r.source) ||
                    t("بطاقة غير متاحة", "Unavailable card")}
                </strong>
                <span>
                  {kinds[r.kind]} ←{" "}
                  {names.get(r.target) ||
                    t("بطاقة غير متاحة", "Unavailable card")}
                </span>
              </div>
              <button
                onClick={() =>
                  void action.run(() =>
                    context.change((state) => ({
                      ...state,
                      relations: state.relations.filter(
                        (item) => item.id !== r.id,
                      ),
                    })),
                  )
                }
              >
                {t("إزالة العلاقة", "Remove relationship")}
              </button>
            </article>
          ))}
      </div>
    </Panel>
  );
}

import type { AssistantReply, Change } from "../../assistant/actions";
import { assistantFieldNames } from "../../assistant/words";
import { useStudio } from "./context";
import { studioValue } from "./formatting";
export default function ChangeDetails({
  change,
  reply,
  changes,
}: {
  change: Change;
  reply?: AssistantReply;
  changes: Change[];
}) {
  const { state, t } = useStudio(),
    after = change.after as Record<string, unknown> | null;
  if (!after) return null;
  const requested = new Set(
    (change.actionIndexes || []).flatMap((index) =>
      Object.keys(reply?.actions[index]?.values || {}),
    ),
  );
  const fields = Object.keys(after).filter(
    (key) =>
      Object.hasOwn(assistantFieldNames, key) &&
      (requested.size ? requested.has(key) : !!after[key]),
  );
  if (!fields.length) return null;
  return (
    <details className="st-change-details">
      <summary>{t("details")}</summary>
      <dl>
        {fields.map((field) => (
          <div key={field}>
            <dt>
              {
                assistantFieldNames[field][
                  state.settings.language === "ar"
                    ? 0
                    : state.settings.language === "en"
                      ? 1
                      : 2
                ]
              }
            </dt>
            <dd dir="auto">
              {field === "day" && typeof after[field] === "number"
                ? new Intl.DateTimeFormat(state.settings.language, {
                    weekday: "long",
                    timeZone: "UTC",
                  }).format(
                    new Date(Date.UTC(2026, 9, 18 + Number(after[field]))),
                  )
                : studioValue(after[field], state, changes)}
            </dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

import type { Project } from "../types";
import type { Language } from "../translations";
import { useExperience } from "./context";
import { cardKey } from "./state";
import { blockers } from "./relations";
import { openWorkHub } from "./openHub";
import { label } from "./helpers";
export default function CardTools({
  project,
  language,
  groupId,
}: {
  project: Project;
  language: Language;
  groupId?: string;
}) {
  const context = useExperience();
  if (!context || groupId) return null;
  const key = cardKey(project.id),
    waiting = blockers(
      context.view.state,
      key,
      new Map(
        (context.cards?.projects || []).map((p) => [cardKey(p.id), p.status]),
      ),
    );
  return (
    <div className="pilot-card-tools">
      {waiting.length > 0 && (
        <small>
          {label(language, "بانتظار متطلبات مرتبطة", "Waiting on dependencies")}{" "}
          · {waiting.length}
        </small>
      )}
      <button
        type="button"
        className="card-secondary"
        onClick={() => openWorkHub(context.uid, "relations", key)}
      >
        {label(language, "التخطيط والتفاصيل", "Planning & details")}
      </button>
      <details>
        <summary>{label(language, "أدوات إضافية", "More tools")}</summary>
        {[
          ["time", "وقت العمل", "Work time"],
          ["review", "المتابعة", "Follow-up"],
          ["history", "سجل النسخ", "Version history"],
          ["templates", "القوالب والتكرار", "Templates & repeat"],
        ].map(([tab, ar, en]) => (
          <button
            type="button"
            key={tab}
            className="card-secondary"
            onClick={() => openWorkHub(context.uid, tab, key)}
          >
            {label(language, ar, en)}
          </button>
        ))}
      </details>
    </div>
  );
}

import type { Project } from "../types";
import type { Language } from "../translations";
import { checklistItems } from "../lib/taskOverview";
import LinkedText from "./LinkedText";
export default function CardPreviewDetails({
  project,
  language,
}: {
  project: Project;
  language: Language;
}) {
  const t = (ar: string, en: string, he: string) =>
      language === "ar" ? ar : language === "he" ? he : en,
    items = checklistItems(project.checklist),
    links = [project.projectUrl, ...(project.links || [])].filter(
      (url): url is string => !!url,
    );
  return (
    <div className="card-preview-details">
      {project.checkpoint && (
        <section>
          <h3>{t("أين توقفت", "Where you stopped", "איפה עצרת")}</h3>
          <p dir="auto">
            <LinkedText text={project.checkpoint} />
          </p>
        </section>
      )}
      {project.description && (
        <section>
          <h3>{t("ملاحظات", "Notes", "הערות")}</h3>
          <p dir="auto">
            <LinkedText text={project.description} />
          </p>
        </section>
      )}
      {!!items.length && (
        <section>
          <h3>
            {t("قائمة المهام", "Checklist", "רשימת משימות")}{" "}
            <small dir="ltr">
              {items.filter((item) => item.done).length}/{items.length}
            </small>
          </h3>
          <ul>
            {items.slice(0, 5).map((item, index) => (
              <li key={index}>
                <span aria-hidden="true">{item.done ? "✓" : "○"}</span>
                <span dir="auto">{item.text}</span>
              </li>
            ))}
          </ul>
          {items.length > 5 && (
            <small>
              {t(
                "بقية البنود في التفاصيل",
                "More items in details",
                "פריטים נוספים בפרטים",
              )}
            </small>
          )}
        </section>
      )}
      {!!links.length && (
        <section>
          <h3>{t("روابط", "Links", "קישורים")}</h3>
          {links.slice(0, 3).map((url, index) => (
            <p key={index}>
              <LinkedText text={url} />
            </p>
          ))}
        </section>
      )}
      {!!project.totalUnits && (
        <section>
          <h3>{t("التقدم", "Progress", "התקדמות")}</h3>
          <p dir="ltr">
            {project.progressUnits || 0} / {project.totalUnits}
          </p>
        </section>
      )}
      {!project.checkpoint &&
        !project.description &&
        !items.length &&
        !links.length &&
        !project.nextStep && (
          <p className="card-preview-empty">
            {t(
              "لا توجد تفاصيل إضافية لهذه البطاقة بعد. يمكنك إضافتها من تفاصيل البطاقة.",
              "This card has no extra details yet. Add them in card details.",
              "אין פרטים נוספים עדיין. ניתן להוסיף בפרטי הכרטיס.",
            )}
          </p>
        )}
    </div>
  );
}

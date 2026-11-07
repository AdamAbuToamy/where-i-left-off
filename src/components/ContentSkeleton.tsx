import type { Language } from "../translations";
import "./ContentSkeleton.css";
/** Presentation only: no fabricated records, controls or persistence. */
export default function ContentSkeleton({
  language,
  layout = "cards",
}: {
  language: Language;
  layout?: "cards" | "study" | "settings";
}) {
  const label = {
    ar: "جارٍ تحميل المحتوى…",
    en: "Loading content…",
    he: "טוען תוכן…",
  }[language];
  return (
    <section
      className={`content-skeleton content-skeleton-${layout}`}
      role="status"
      aria-label={label}
      aria-busy="true"
    >
      <span className="sr-only">{label}</span>
      <div aria-hidden="true">
        <div className="skeleton-toolbar">
          <i />
          <i />
          <i />
        </div>
        <div className="skeleton-grid">
          {Array.from({ length: layout === "settings" ? 3 : 6 }, (_, index) => (
            <div className="skeleton-card" key={index}>
              <i />
              <i />
              <i />
              <i />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

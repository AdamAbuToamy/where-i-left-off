import { useState, useEffect } from "react";
import type { Language } from "../translations";
import { doc, onSnapshot } from "firebase/firestore";
import { normalizedProject } from "../lib/workspaceModel";
import { ProjectEntity } from "../lib/projectEntity";
import type { StoredCardVersion } from "./cardHistory";
import { db, auth } from "../lib/firebase";
import ChoicePicker from "../components/ChoicePicker";
import type { Project } from "../types";
import { useExperience } from "./context";
import { cardKey } from "./state";
import { restoreContent } from "./history";
import type { CardVersion } from "./history";
import { label, useFeatureAction } from "./helpers";
import { Panel, FeatureStatus } from "./ui";
export default function HistoryPanel({
  language,
  selected = "",
}: {
  language: Language;
  selected?: string;
}) {
  const context = useExperience()!,
    cards = context.cards?.projects || [],
    [key, setKey] = useState(selected),
    project = cards.find((p) => cardKey(p.id) === key),
    t = (a: string, e: string) => label(language, a, e);
  return (
    <Panel title={t("سجل النسخ والاستعادة", "Version history & restore")}>
      <p className="pilot-muted">
        {t(
          "نسخ بطاقاتك الشخصية منذ تفعيل التجربة؛ تشمل التعديلات المؤكدة من الموقع والمساعد.",
          "Personal-card versions recorded since enabling this preview, including confirmed site and assistant edits.",
        )}
      </p>
      <ChoicePicker
        label={t("البطاقة", "Card")}
        value={key}
        onChange={setKey}
        options={[
          { value: "", label: t("اختر بطاقة", "Choose a card") },
          ...cards.map((p) => ({ value: cardKey(p.id), label: p.name })),
        ]}
      />
      {project && (
        <VersionFeed key={project.id} project={project} language={language} />
      )}
    </Panel>
  );
}
function VersionFeed({
  project,
  language,
}: {
  project: Project;
  language: Language;
}) {
  const context = useExperience()!,
    [rows, setRows] = useState<CardVersion[]>([]),
    [loadError, setLoadError] = useState(false),
    [cached, setCached] = useState(false),
    [retry, setRetry] = useState(0),
    [preview, setPreview] = useState<{
      saved: Project;
      revision: number;
    } | null>(null),
    action = useFeatureAction(language),
    t = (a: string, e: string) => label(language, a, e);
  useEffect(() => {
    let active = true;
    const stop = onSnapshot(
      doc(db!, "users", context.uid, "projects", project.id),
      { includeMetadataChanges: true },
      (snapshot) => {
        if (
          !active ||
          auth?.currentUser?.uid !== context.uid ||
          snapshot.metadata.hasPendingWrites
        )
          return;
        try {
          if (!snapshot.exists()) {
            setRows([]);
            return;
          }
          const data = snapshot.data(),
            history = data.versionHistory as
              | {
                  entries?: StoredCardVersion[];
                  revision?: number;
                  mutationId?: string;
                  actorId?: string;
                  actorName?: string;
                  source?: CardVersion["source"];
                }
              | undefined,
            current = normalizedProject(snapshot.id, data),
            known = history?.revision === current.revision;
          const versions: CardVersion[] = [
            {
              id: String(data.mutationId || "current"),
              cardId: project.id,
              actorId: context.uid,
              actorName: known ? history?.actorName || "" : "",
              source: known ? history?.source || "legacy" : "legacy",
              at: data.updatedAt?.toMillis?.() || 0,
              before: null,
              after: ProjectEntity.restore(current).snapshot(),
            },
          ];
          if (
            history?.entries !== undefined &&
            (!Array.isArray(history.entries) || history.entries.length > 20)
          )
            throw new Error("experience-invalid");
          for (const entry of [...(history?.entries || [])].reverse()) {
            if (
              entry.actorId !== context.uid ||
              !["workspace", "assistant", "legacy"].includes(entry.source) ||
              typeof entry.payload !== "string" ||
              entry.payload.length > 40000 ||
              typeof entry.actorName !== "string" ||
              entry.actorName.length > 100
            )
              throw new Error("experience-invalid");
            const saved = ProjectEntity.restore(
              JSON.parse(entry.payload),
            ).snapshot();
            if (saved.id !== project.id || saved.revision !== entry.revision)
              throw new Error("experience-invalid");
            versions.push({
              id: entry.mutationId + ":" + entry.revision,
              cardId: project.id,
              actorId: entry.actorId,
              actorName: entry.actorName,
              source: entry.source,
              at: entry.at,
              before: null,
              after: saved,
            });
          }
          setRows(versions);
          setCached(snapshot.metadata.fromCache);
          setLoadError(false);
        } catch {
          setLoadError(true);
        }
      },
      () => {
        if (active) setLoadError(true);
      },
    );
    return () => {
      active = false;
      stop();
    };
  }, [context.uid, project.id, retry]);
  return (
    <>
      <FeatureStatus {...action} />
      <p className="pilot-muted">
        {t(
          "آخر 20 نسخة سابقة مع النسخة الحالية. الحذف النهائي لا يمكن التراجع عنه.",
          "The current version and up to 20 previous versions. Permanent deletion cannot be undone.",
        )}
        {cached ? " · " + t("نسخة محلية", "Cached copy") : ""}
      </p>
      {loadError && (
        <p role="alert">
          {t("تعذّر تحميل السجل.", "Could not load history.")}
          <button onClick={() => setRetry((n) => n + 1)}>
            {t("إعادة المحاولة", "Retry")}
          </button>
        </p>
      )}
      <div className="pilot-list">
        {rows.map((row, index) => (
          <article key={row.id}>
            <details>
              <summary>
                {row.at
                  ? new Date(row.at).toLocaleString(language)
                  : t("نسخة قديمة", "Legacy version")}{" "}
                · {row.actorName || t("أنت", "You")} ·{" "}
                {row.source === "assistant"
                  ? t("المساعد", "Assistant")
                  : row.source === "legacy"
                    ? t("قبل تسجيل المصدر", "Source not recorded")
                    : t("الموقع", "Site")}
                {index === 0 ? " · " + t("الحالية", "Current") : ""}
              </summary>
              <p>
                {t("الاسم: ", "Name: ")}
                {row.after?.name}
              </p>
              <p>
                {t("الخطوة: ", "Next step: ")}
                {row.after?.nextStep}
              </p>
              <p>
                {t("ملاحظة: ", "Note: ")}
                {row.after?.checkpoint}
              </p>
            </details>
            <button
              disabled={!row.after || index === 0 || action.busy}
              onClick={() =>
                row.after &&
                setPreview({ saved: row.after, revision: project.revision })
              }
            >
              {t("مراجعة استعادة هذه النسخة", "Review restoring this version")}
            </button>
          </article>
        ))}
      </div>
      {!rows.length && !loadError && (
        <p>
          {t(
            "لا توجد نسخ مسجلة لهذه البطاقة بعد.",
            "No recorded versions for this card yet.",
          )}
        </p>
      )}
      {preview && (
        <section className="pilot-warning">
          <h3>{t("مراجعة الاستعادة", "Review restoration")}</h3>
          <p>
            {project.name} → {preview.saved.name}
          </p>
          <p>{preview.saved.nextStep}</p>
          <p>{preview.saved.checkpoint}</p>
          <p>
            {t(
              "سيُستعاد المحتوى مع إبقاء هوية البطاقة وترتيبها الحالي.",
              "Content is restored while keeping the card identity and current order.",
            )}
          </p>
          <button
            disabled={!context.workspace || action.busy}
            onClick={() =>
              void action.run(
                async () => {
                  const current = context.cards?.projects.find(
                    (p) => p.id === project.id,
                  );
                  if (!current) throw new Error("experience-conflict");
                  const fields = restoreContent(
                    current,
                    preview.saved,
                    preview.revision,
                    Date.now(),
                  );
                  await context.workspace!.change(current, "edit", fields);
                  setPreview(null);
                },
                t(
                  "وُضعت الاستعادة في قائمة الحفظ؛ راقب المزامنة.",
                  "Restoration queued; check sync status.",
                ),
              )
            }
          >
            {t("تطبيق الاستعادة", "Apply restoration")}
          </button>
          <button onClick={() => setPreview(null)}>
            {t("إلغاء", "Cancel")}
          </button>
        </section>
      )}
    </>
  );
}

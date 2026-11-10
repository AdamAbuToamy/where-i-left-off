import { createPortal } from "react-dom";
import { usePhoneLayout, usePhoneSurface } from "./usePhoneSurface";
import { useDesignPreview } from "./designPreviewContext";
import CompactCardShell from "./CompactCardShell";
import { markCardViewed } from "../lib/pushNotifications";
import FocusSession from "./FocusSession";
import CatalogLookup from "./CatalogLookup";
import type { User } from "firebase/auth";
import { auth } from "../lib/firebase";
import { workflowText } from "../workflowText";
import { cardAction } from "../lib/cardAction";
import ExtraLinks from "./ExtraLinks";
import LinkedText from "./LinkedText";
import { useEffect, useRef, useState, lazy, Suspense } from "react";
import type { ReactNode, FormEvent } from "react";
import type { Project, Section, GroupMember } from "../types";
import type { Language } from "../translations";
import { translations } from "../translations";
import DeleteProjectDialog from "./DeleteProjectDialog";
import "./ProjectCard.css";
import { groupText } from "../groupTranslations";
import { recallText } from "../recallTranslations";
import { checklistItems } from "../lib/taskOverview";
import { toggleChecklist } from "../lib/projects";
import type { ProjectDetails } from "../lib/projects";
import RecallFields from "./RecallFields";
import type { RecallDetails } from "./RecallFields";

const CardReminderControl = lazy(() => import("./CardReminderControl"));

type ProjectCardProps = {
  summaryExtras?: ReactNode;
  disabled?: boolean;
  project: Project;
  sections: Section[];
  language: Language;
  groupId?: string;
  members?: GroupMember[];
  canManage?: boolean;
  canEdit?: boolean;
  onToggle: (id: string) => void;
  onUpdate: (
    id: string,
    name: string,
    nextStep: string,
    details: ProjectDetails,
    revision: number,
  ) => Promise<boolean>;
  onDelete: (id: string, revision: number) => Promise<boolean>;
};

export default function ProjectCard({
  summaryExtras,
  disabled,
  project,
  sections,
  language,
  groupId,
  members,
  canManage = true,
  canEdit = true,
  onUpdate,
  onDelete,
}: ProjectCardProps) {
  const t = translations[language],
    r = recallText[language],
    g = groupText[language];
  const [metadata, setMetadata] = useState<RecallDetails>({
    assignedTo: project.assignedTo,
    sectionId: project.sectionId,
    kind: project.kind || "resume",
    status: project.status,
    checkpoint: project.checkpoint,
    checklist: project.checklist,
    resourceType: project.resourceType,
    progressUnits: project.progressUnits,
    totalUnits: project.totalUnits,
    followUpDate: project.followUpDate,
    coverUrl: project.coverUrl,
    description: project.description,
    catalogSource: project.catalogSource,
    catalogId: project.catalogId,
  });
  const [optimisticChecklist, setOptimisticChecklist] = useState<{
    revision: number;
    text: string;
  } | null>(null);
  const checklist =
    optimisticChecklist?.revision === project.revision
      ? optimisticChecklist.text
      : (project.checklist ?? "");
  const action = cardAction(project, language);
  const isActive = project.status === "active";

  const [detailsOpen, setDetailsOpen] = useState(false);
  const phone = usePhoneLayout(),
    { kitchenStudy } = useDesignPreview(),
    surface = useRef<HTMLElement>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const fullscreen = !!kitchenStudy && (detailsOpen || isEditing);
  const [detailPage, setDetailPage] = useState("overview");
  const pages =
    language === "ar"
      ? {
          overview: "المتابعة",
          tasks: "قائمة المهام",
          notes: "الملاحظات",
          links: "الروابط والمواعيد",
        }
      : language === "he"
        ? {
            overview: "המשך עבודה",
            tasks: "רשימת משימות",
            notes: "הערות",
            links: "קישורים ותאריכים",
          }
        : {
            overview: "Overview",
            tasks: "Checklist",
            notes: "Notes",
            links: "Links and dates",
          };
  usePhoneSurface(surface, fullscreen, phone ? "phone" : "card");
  useEffect(() => {
    if (!fullscreen) return;
    requestAnimationFrame(() =>
      surface.current
        ?.querySelector<HTMLButtonElement>(".card-detail-heading button")
        ?.focus({ preventScroll: true }),
    );
    if (phone) return;
    document.body.classList.add("card-detail-docked");
    const close = (event: KeyboardEvent) => {
      if (
        event.key === "Escape" &&
        !event.defaultPrevented &&
        !isEditing &&
        !document.querySelector("dialog[open]")
      ) {
        setDetailsOpen(false);
      }
    };
    document.addEventListener("keydown", close);
    return () => {
      document.body.classList.remove("card-detail-docked");
      document.removeEventListener("keydown", close);
      requestAnimationFrame(() =>
        document
          .querySelector<HTMLButtonElement>(
            `[data-project="${CSS.escape(project.id)}"] .envelope-expand`,
          )
          ?.focus({ preventScroll: true }),
      );
    };
  }, [fullscreen, phone, isEditing, project.id]);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [name, setName] = useState(project.name);
  const [nextStep, setNextStep] = useState(project.nextStep);
  const [projectUrl, setProjectUrl] = useState(project.projectUrl ?? "");
  const [attachmentUrl, setAttachmentUrl] = useState(
    project.attachmentUrl ?? "",
  );
  const [dueDate, setDueDate] = useState(project.dueDate ?? "");
  const [links, setLinks] = useState<string[]>(project.links || []);

  const revisionRef = useRef(project.revision);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const deleteButtonRef = useRef<HTMLButtonElement>(null);

  function startEditing() {
    setSaveFailed(false);
    void markCardViewed(project.id, groupId);
    revisionRef.current = project.revision;
    setMetadata({
      assignedTo: project.assignedTo,
      sectionId: project.sectionId,
      kind: project.kind || "resume",
      status: project.status,
      checkpoint: project.checkpoint,
      checklist: project.checklist,
      resourceType: project.resourceType,
      progressUnits: project.progressUnits,
      totalUnits: project.totalUnits,
      followUpDate: project.followUpDate,
      coverUrl: project.coverUrl,
      description: project.description,
      catalogSource: project.catalogSource,
      catalogId: project.catalogId,
    });
    setName(project.name);
    setNextStep(project.nextStep);
    setProjectUrl(project.projectUrl ?? "");
    setAttachmentUrl(project.attachmentUrl ?? "");
    setDueDate(project.dueDate ?? "");
    setLinks(project.links || []);
    setIsEditing(true);
    requestAnimationFrame(() =>
      surface.current?.scrollTo?.({ top: 0, behavior: "instant" }),
    );
  }

  function finishEditing() {
    setIsEditing(false);
    requestAnimationFrame(() => editButtonRef.current?.focus());
  }

  function cancelDelete() {
    setIsDeleteOpen(false);
    requestAnimationFrame(() => deleteButtonRef.current?.focus());
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveFailed(false);
    if (!name.trim()) return;

    if (
      !(await onUpdate(
        project.id,
        name.trim(),
        nextStep.trim(),
        {
          ...metadata,
          projectUrl: projectUrl.trim(),
          attachmentUrl: attachmentUrl.trim(),
          dueDate,
          links: links.map((url) => url.trim()).filter(Boolean),
        },
        revisionRef.current,
      ))
    ) {
      setSaveFailed(true);
      return;
    }
    finishEditing();
  }

  const content = (
    <>
      <article
        ref={surface}
        role={fullscreen ? "dialog" : undefined}
        aria-modal={fullscreen || undefined}
        aria-label={fullscreen ? project.name : undefined}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("a,button,summary,input"))
            void markCardViewed(project.id, groupId);
        }}
        data-project={project.id}
        className={`project-card ${fullscreen ? (phone ? "phone-card-fullscreen card-detail-panel" : "desktop-card-panel card-detail-panel") : ""} ${isActive ? "is-active" : ""} is-${project.status}`}
      >
        {fullscreen && (
          <div className="phone-surface-heading card-detail-heading">
            <strong>{isEditing ? t.editProject : project.name}</strong>
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                if (isEditing) finishEditing();
                else setDetailsOpen(false);
              }}
            >
              {language === "ar" ? "رجوع" : language === "he" ? "חזרה" : "Back"}
            </button>
          </div>
        )}
        <span
          key={project.status}
          className={`status ${isActive ? "status-active" : ""}`}
        >
          {r[project.status]}
        </span>

        {fullscreen && saveFailed && (
          <p className="notice error" role="alert">
            {language === "ar"
              ? "تعذّر الحفظ. بقيت بياناتك هنا؛ راجع الحقول أو الاتصال وأعد المحاولة."
              : language === "he"
                ? "לא ניתן לשמור. הפרטים נשמרו כאן; בדקו את השדות או החיבור ונסו שוב."
                : "Could not save. Your entries are kept here; check the fields or connection and retry."}
          </p>
        )}
        {isEditing ? (
          <form
            className="card-editor card-editor-dashboard"
            onSubmit={handleSubmit}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                finishEditing();
              }
            }}
          >
            <section className="card-editor-basics">
              <h3>
                {language === "ar"
                  ? "أساسيات البطاقة"
                  : language === "he"
                    ? "פרטי הכרטיס"
                    : "Card essentials"}
              </h3>
              <label htmlFor={`name-${project.id}`}>{t.projectName}</label>

              <input
                disabled={!canManage}
                id={`name-${project.id}`}
                autoFocus={!phone}
                dir="auto"
                required
                maxLength={100}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />

              {canManage && (
                <CatalogLookup
                  name={name}
                  type={metadata.resourceType}
                  language={language}
                  onChoose={(title, values) => {
                    setName(title);
                    setMetadata({ ...metadata, ...values });
                    if (values.projectUrl) setProjectUrl(values.projectUrl);
                  }}
                />
              )}
              <RecallFields
                hideTextFields
                hideDescription
                members={members}
                progressOnly={!canManage}
                value={metadata}
                onChange={setMetadata}
                sections={sections}
                language={language}
                prefix={`edit-${project.id}`}
              />
            </section>
            <div className="card-editor-addons">
              <EditorDisclosure
                language={language}
                title={t.nextStep}
                populated={!!nextStep}
              >
                {" "}
                <label htmlFor={`step-${project.id}`}>{t.nextStep}</label>
                <textarea
                  id={`step-${project.id}`}
                  dir="auto"
                  rows={4}
                  maxLength={1000}
                  placeholder={t.nextStepInputPlaceholder}
                  value={nextStep}
                  onChange={(event) => setNextStep(event.target.value)}
                />
              </EditorDisclosure>
              <EditorDisclosure
                language={language}
                title={
                  language === "ar"
                    ? "ملاحظات ونقطة التوقف"
                    : language === "he"
                      ? "הערות ונקודת עצירה"
                      : "Notes and checkpoint"
                }
                populated={!!(metadata.description || metadata.checkpoint)}
              >
                <label htmlFor={`edit-${project.id}-description`}>
                  {language === "ar"
                    ? "ملاحظات"
                    : language === "he"
                      ? "הערות"
                      : "Notes"}
                </label>
                <textarea
                  id={`edit-${project.id}-description`}
                  rows={3}
                  maxLength={1000}
                  dir="auto"
                  value={metadata.description || ""}
                  disabled={!canManage}
                  onChange={(e) =>
                    setMetadata({ ...metadata, description: e.target.value })
                  }
                />
                <label htmlFor={`edit-${project.id}-checkpoint`}>
                  {r.checkpoint}
                </label>
                <textarea
                  id={`edit-${project.id}-checkpoint`}
                  rows={3}
                  maxLength={1000}
                  dir="auto"
                  value={metadata.checkpoint || ""}
                  onChange={(e) =>
                    setMetadata({ ...metadata, checkpoint: e.target.value })
                  }
                />
              </EditorDisclosure>
              <EditorDisclosure
                language={language}
                title={r.checklist}
                populated={!!metadata.checklist}
              >
                <label htmlFor={`edit-${project.id}-checklist`}>
                  {r.checklist}
                </label>
                <textarea
                  id={`edit-${project.id}-checklist`}
                  rows={5}
                  maxLength={3000}
                  dir="auto"
                  value={metadata.checklist || ""}
                  onChange={(e) =>
                    setMetadata({ ...metadata, checklist: e.target.value })
                  }
                />
              </EditorDisclosure>
              <EditorDisclosure
                language={language}
                title={pages.links}
                populated={
                  !!(projectUrl || attachmentUrl || links.length || dueDate)
                }
              >
                {" "}
                <label htmlFor={`url-${project.id}`}>{t.projectUrl}</label>
                <input
                  disabled={!canManage}
                  id={`url-${project.id}`}
                  type="url"
                  inputMode="url"
                  maxLength={500}
                  value={projectUrl}
                  onChange={(event) => setProjectUrl(event.target.value)}
                />
                <label htmlFor={`attachment-${project.id}`}>
                  {t.attachmentUrl}
                </label>
                <input
                  disabled={!canManage}
                  id={`attachment-${project.id}`}
                  type="url"
                  inputMode="url"
                  maxLength={500}
                  value={attachmentUrl}
                  onChange={(event) => setAttachmentUrl(event.target.value)}
                />
                <ExtraLinks
                  value={links}
                  onChange={setLinks}
                  language={language}
                  prefix={`edit-${project.id}`}
                  disabled={!canManage}
                />
                <label htmlFor={`date-${project.id}`}>{t.dueDate}</label>
                <input
                  disabled={!canManage}
                  id={`date-${project.id}`}
                  type="date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                />
              </EditorDisclosure>
            </div>
            <div className="card-editor-save-actions">
              {" "}
              <button type="submit" disabled={!name.trim()}>
                {t.saveChanges}
              </button>
              <button
                type="button"
                className="card-secondary"
                onClick={finishEditing}
              >
                {t.cancel}
              </button>
            </div>
          </form>
        ) : (
          <CompactCardShell
            summaryExtras={summaryExtras}
            expanded={detailsOpen}
            onExpandedChange={(open) => {
              if (open) setDetailPage("overview");
              setDetailsOpen(open);
            }}
            project={project}
            sections={sections}
            language={language}
          >
            {project.coverUrl && (
              <img
                className="card-cover"
                onError={(e) => {
                  e.currentTarget.hidden = true;
                }}
                src={project.coverUrl}
                alt=""
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            )}
            <h2 dir="auto">
              <LinkedText text={project.name} />
            </h2>

            {members && (
              <p className="assignment-badge">
                {g.assigned}:{" "}
                <span dir="auto">
                  {project.assignedTo
                    ? members.find((m) => m.uid === project.assignedTo)?.name ||
                      g.removed
                    : g.unassigned}
                </span>
              </p>
            )}
            <div className="card-meta">
              <span>{r[project.kind || "resume"]}</span>
              <span dir="auto">
                {sections.find((s) => s.id === project.sectionId)?.name ||
                  r.noSection}
              </span>
            </div>
            {fullscreen && (
              <nav
                className="card-detail-pages"
                aria-label={
                  language === "ar"
                    ? "تفاصيل البطاقة"
                    : language === "he"
                      ? "פרטי הכרטיס"
                      : "Card details"
                }
              >
                {Object.entries(pages).map(([key, label]) => (
                  <button
                    type="button"
                    key={key}
                    aria-pressed={detailPage === key}
                    onClick={() => setDetailPage(key)}
                  >
                    {label}
                  </button>
                ))}
              </nav>
            )}
            <section
              className="card-detail-page"
              hidden={fullscreen && detailPage !== "overview"}
              aria-label={pages.overview}
            >
              {project.checkpoint && (
                <>
                  <p className="label">{r.checkpoint}</p>
                  <p className="checkpoint-copy" dir="auto">
                    <LinkedText text={project.checkpoint} />
                  </p>
                </>
              )}
            </section>
            <section
              className="card-detail-page"
              hidden={fullscreen && detailPage !== "tasks"}
              aria-label={pages.tasks}
            >
              {fullscreen && !checklistItems(checklist).length && (
                <p className="card-detail-empty">
                  {language === "ar"
                    ? "لا توجد عناصر في قائمة المهام بعد."
                    : language === "he"
                      ? "אין עדיין פריטים ברשימה."
                      : "No checklist items yet."}
                </p>
              )}
              {!!checklistItems(checklist).length && (
                <ol className="recall-checklist">
                  {checklistItems(checklist).map((item, number) => (
                    <li key={item.index}>
                      <label>
                        <input
                          type="checkbox"
                          disabled={!canEdit}
                          checked={item.done}
                          onChange={() => {
                            const text = toggleChecklist(checklist, item.index);
                            setOptimisticChecklist({
                              revision: project.revision,
                              text,
                            });
                            void onUpdate(
                              project.id,
                              project.name,
                              project.nextStep,
                              { ...project, checklist: text },
                              project.revision,
                            ).then((ok) => {
                              if (!ok) setOptimisticChecklist(null);
                            });
                          }}
                        />
                        <span className="check-number" aria-hidden="true">
                          {number + 1}.
                        </span>
                        <span dir="auto">
                          <LinkedText text={item.text} />
                        </span>
                      </label>
                    </li>
                  ))}
                </ol>
              )}
            </section>
            <section
              className="card-detail-page"
              hidden={fullscreen && detailPage !== "notes"}
              aria-label={pages.notes}
            >
              {fullscreen && !project.description && (
                <p className="card-detail-empty">
                  {language === "ar"
                    ? "لا توجد ملاحظات بعد."
                    : language === "he"
                      ? "אין עדיין הערות."
                      : "No notes yet."}
                </p>
              )}
              {project.catalogSource && (
                <small className="catalog-credit">
                  <a
                    href={
                      project.catalogSource === "tvmaze"
                        ? `https://www.tvmaze.com/shows/${project.catalogId}`
                        : `https://openlibrary.org/works/${project.catalogId}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {workflowText[language].source}:{" "}
                    {project.catalogSource === "tvmaze"
                      ? "TVmaze"
                      : "Open Library"}
                  </a>
                </small>
              )}
              {project.description && (
                <details
                  className="resource-description"
                  open={fullscreen || undefined}
                >
                  <summary>
                    {language === "ar"
                      ? "الملاحظات والوصف"
                      : language === "he"
                        ? "הערות ותיאור"
                        : "Notes and description"}
                  </summary>
                  <p dir="auto">
                    <LinkedText text={project.description} />
                  </p>
                </details>
              )}
            </section>
            <section
              className="card-detail-page"
              hidden={fullscreen && detailPage !== "overview"}
              aria-label={t.nextStep}
            >
              {!!project.totalUnits && (
                <p className="resource-count">
                  {project.progressUnits || 0} / {project.totalUnits}
                </p>
              )}
              {project.followUpDate && (
                <p>
                  {workflowText[language].followUp}:{" "}
                  <time dateTime={project.followUpDate}>
                    {project.followUpDate}
                  </time>
                </p>
              )}
              {project.nextStep && (
                <>
                  <p className="label">{t.nextStep}</p>
                  <p className="next-step" dir="auto">
                    <LinkedText text={project.nextStep} />
                  </p>
                </>
              )}
            </section>
            <section
              className="card-detail-page"
              hidden={fullscreen && detailPage !== "links"}
              aria-label={pages.links}
            >
              {fullscreen &&
                !project.projectUrl &&
                !project.attachmentUrl &&
                !project.links?.length &&
                !project.dueDate && (
                  <p className="card-detail-empty">
                    {language === "ar"
                      ? "لا توجد روابط أو مواعيد بعد."
                      : language === "he"
                        ? "אין עדיין קישורים או תאריכים."
                        : "No links or dates yet."}
                  </p>
                )}
              {(project.projectUrl ||
                project.attachmentUrl ||
                project.links?.length ||
                project.dueDate) && (
                <div className="project-details">
                  {project.dueDate && (
                    <p className="project-date">
                      <strong>{t.dueDate}:</strong>{" "}
                      <time dateTime={project.dueDate}>{project.dueDate}</time>
                    </p>
                  )}
                  {project.projectUrl && (
                    <a
                      href={project.projectUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      ↗ {r.open}
                    </a>
                  )}
                  {project.links?.map((url, i) => (
                    <a
                      key={i}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      dir="ltr"
                    >
                      ↗ {url}
                    </a>
                  ))}
                  {project.attachmentUrl && (
                    <a
                      href={project.attachmentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      ↗ {t.attachmentUrl}
                    </a>
                  )}
                </div>
              )}
            </section>
            <section
              className="card-detail-page card-detail-actions"
              hidden={fullscreen && detailPage !== "overview"}
            >
              {fullscreen && (
                <Suspense
                  fallback={
                    <button type="button" className="card-secondary" disabled>
                      {language === "ar"
                        ? "تذكير البطاقة"
                        : language === "he"
                          ? "תזכורת לכרטיס"
                          : "Card reminder"}
                    </button>
                  }
                >
                  <CardReminderControl
                    compact
                    id={project.id}
                    groupId={groupId}
                    name={project.name}
                    dueDate={project.dueDate}
                    language={language}
                  />
                </Suspense>
              )}
              {canEdit && (
                <button
                  type="button"
                  onClick={() =>
                    void onUpdate(
                      project.id,
                      project.name,
                      project.nextStep,
                      { ...project, status: action.status },
                      project.revision,
                    )
                  }
                >
                  <span
                    key={`${language}-${project.status}`}
                    className="button-copy"
                  >
                    {action.label}
                  </span>
                </button>
              )}

              {canEdit &&
                project.status !== "waiting" &&
                project.resourceType !== "shopping" &&
                project.resourceType !== "idea" &&
                auth?.currentUser && (
                  <FocusSession
                    project={project}
                    user={auth.currentUser as User}
                    language={language}
                    groupId={groupId}
                    onSave={(details, revision) =>
                      onUpdate(
                        project.id,
                        project.name,
                        details.nextStep ?? project.nextStep,
                        { ...project, ...details },
                        revision,
                      )
                    }
                  />
                )}
            </section>
            {(canEdit || canManage) && (
              <div className="card-options card-options-visible">
                <div className="card-actions">
                  {canEdit && (
                    <button
                      ref={editButtonRef}
                      type="button"
                      className="card-secondary"
                      onClick={startEditing}
                    >
                      {t.editProject}
                    </button>
                  )}

                  {canManage && (
                    <button
                      className="card-secondary"
                      onClick={() =>
                        void onUpdate(
                          project.id,
                          project.name,
                          project.nextStep,
                          { ...project, archivedAt: Date.now() },
                          project.revision,
                        )
                      }
                    >
                      {workflowText[language].archiveCard}
                    </button>
                  )}
                  {canManage && (
                    <button
                      ref={deleteButtonRef}
                      type="button"
                      className="card-delete"
                      onClick={() => {
                        revisionRef.current = project.revision;
                        setIsDeleteOpen(true);
                      }}
                    >
                      {t.deleteProject}
                    </button>
                  )}
                </div>
              </div>
            )}
          </CompactCardShell>
        )}
      </article>

      {isDeleteOpen && (
        <DeleteProjectDialog
          open={isDeleteOpen}
          projectName={project.name}
          language={language}
          onCancel={cancelDelete}
          onConfirm={() => onDelete(project.id, revisionRef.current)}
        />
      )}
    </>
  );
  return fullscreen ? (
    <>
      {!phone && (
        <div className="card-panel-placeholder" aria-hidden="true">
          {project.name}
        </div>
      )}
      {createPortal(
        <fieldset
          className="phone-form-boundary"
          dir={language === "en" ? "ltr" : "rtl"}
          disabled={disabled}
        >
          {content}
        </fieldset>,
        document.body,
      )}
    </>
  ) : (
    content
  );
}

function EditorDisclosure({
  title,
  populated,
  language,
  children,
}: {
  title: string;
  populated: boolean;
  language: Language;
  children: ReactNode;
}) {
  return (
    <details className="card-editor-addon">
      <summary>
        <span>{title}</span>
        <small>
          {populated
            ? language === "ar"
              ? "مضاف"
              : language === "he"
                ? "נוסף"
                : "Added"
            : language === "ar"
              ? "إضافة"
              : language === "he"
                ? "הוספה"
                : "Add"}
        </small>
      </summary>
      <div className="card-editor-addon-content">{children}</div>
    </details>
  );
}

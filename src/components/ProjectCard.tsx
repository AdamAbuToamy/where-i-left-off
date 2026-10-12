import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { Project, Section, GroupMember } from '../types'
import type { Language } from '../translations'
import { translations } from '../translations'
import DeleteProjectDialog from './DeleteProjectDialog'
import './ProjectCard.css'
import { groupText } from '../groupTranslations'
import { recallText } from '../recallTranslations'
import { toggleChecklist } from '../lib/projects'
import type { ProjectDetails } from '../lib/projects'
import RecallFields from './RecallFields'
import type { RecallDetails } from './RecallFields'

type ProjectCardProps = {
  project: Project
  sections: Section[]
  language: Language
  members?: GroupMember[]
  canManage?: boolean
  canEdit?: boolean
  onToggle: (id: string) => void
  onUpdate: (id: string, name: string, nextStep: string, details: ProjectDetails, revision: number) => Promise<boolean>
  onDelete: (id: string, revision: number) => Promise<boolean>
}

export default function ProjectCard({
  project,
  sections,
  language,
  members, canManage = true, canEdit = true,
  onToggle,
  onUpdate,
  onDelete,
}: ProjectCardProps) {
  const t = translations[language], r = recallText[language], g = groupText[language]
  const [metadata, setMetadata] = useState<RecallDetails>({ assignedTo: project.assignedTo, sectionId: project.sectionId, kind: project.kind || 'resume', status: project.status, checkpoint: project.checkpoint, checklist: project.checklist })
  const [optimisticChecklist, setOptimisticChecklist] = useState<{ revision: number; text: string } | null>(null)
  const checklist = optimisticChecklist?.revision === project.revision ? optimisticChecklist.text : project.checklist ?? ''
  const isActive = project.status === 'active'

  const [isEditing, setIsEditing] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [name, setName] = useState(project.name)
  const [nextStep, setNextStep] = useState(project.nextStep)
  const [projectUrl, setProjectUrl] = useState(project.projectUrl ?? '')
  const [attachmentUrl, setAttachmentUrl] = useState(project.attachmentUrl ?? '')
  const [dueDate, setDueDate] = useState(project.dueDate ?? '')

  const revisionRef = useRef(project.revision)
  const editButtonRef = useRef<HTMLButtonElement>(null)
  const deleteButtonRef = useRef<HTMLButtonElement>(null)

  function startEditing() {
    revisionRef.current = project.revision
    setMetadata({ assignedTo: project.assignedTo, sectionId: project.sectionId, kind: project.kind || 'resume', status: project.status, checkpoint: project.checkpoint, checklist: project.checklist })
    setName(project.name)
    setNextStep(project.nextStep)
    setProjectUrl(project.projectUrl ?? '')
    setAttachmentUrl(project.attachmentUrl ?? '')
    setDueDate(project.dueDate ?? '')
    setIsEditing(true)
  }

  function finishEditing() {
    setIsEditing(false)
    requestAnimationFrame(() => editButtonRef.current?.focus())
  }

  function cancelDelete() {
    setIsDeleteOpen(false)
    requestAnimationFrame(() => deleteButtonRef.current?.focus())
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!name.trim()) return

    if (!await onUpdate(project.id, name.trim(), nextStep.trim(), { projectUrl: projectUrl.trim(), attachmentUrl: attachmentUrl.trim(), dueDate, ...metadata }, revisionRef.current)) return
    finishEditing()
  }

  return (
    <>
      <article className={`project-card ${isActive ? 'is-active' : ''} is-${project.status}`}>
        <span
          key={project.status}
          className={`status ${isActive ? 'status-active' : ''}`}
        >
          {r[project.status]}
        </span>

        {isEditing ? (
          <form
            className="card-editor"
            onSubmit={handleSubmit}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault()
                finishEditing()
              }
            }}
          >
            <label htmlFor={`name-${project.id}`}>{t.projectName}</label>

            <input
              disabled={!canManage}
              id={`name-${project.id}`}
              autoFocus
              dir="auto"
              required
              maxLength={100}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />

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

            <RecallFields members={members} progressOnly={!canManage} value={metadata} onChange={setMetadata} sections={sections} language={language} prefix={`edit-${project.id}`} />
            <label htmlFor={`url-${project.id}`}>{t.projectUrl}</label>
            <input disabled={!canManage} id={`url-${project.id}`} type="url" inputMode="url" maxLength={500} value={projectUrl} onChange={event => setProjectUrl(event.target.value)} />

            <label htmlFor={`attachment-${project.id}`}>{t.attachmentUrl}</label>
            <input disabled={!canManage} id={`attachment-${project.id}`} type="url" inputMode="url" maxLength={500} value={attachmentUrl} onChange={event => setAttachmentUrl(event.target.value)} />

            <label htmlFor={`date-${project.id}`}>{t.dueDate}</label>
            <input disabled={!canManage} id={`date-${project.id}`} type="date" value={dueDate} onChange={event => setDueDate(event.target.value)} />

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
          </form>
        ) : (
          <>
            <h2 dir="auto">{project.name}</h2>

            {members && <p className="assignment-badge">{g.assigned}: <span dir="auto">{project.assignedTo ? members.find(m => m.uid === project.assignedTo)?.name || g.removed : g.unassigned}</span></p>}
            <div className="card-meta"><span>{r[project.kind || 'resume']}</span><span dir="auto">{sections.find(s => s.id === project.sectionId)?.name || r.noSection}</span></div>
            {project.checkpoint && <><p className="label">{r.checkpoint}</p><p className="checkpoint-copy" dir="auto">{project.checkpoint}</p></>}
            {project.kind === 'list' && checklist && <div className="recall-checklist">{checklist.split('\n').map((line, index) => line.trim() && <label key={index}><input type="checkbox" disabled={!canEdit} checked={/^\[x\] /i.test(line)} onChange={() => { const text = toggleChecklist(checklist, index); setOptimisticChecklist({ revision: project.revision, text }); void onUpdate(project.id, project.name, project.nextStep, { ...project, checklist: text }, project.revision).then(ok => { if (!ok) setOptimisticChecklist(null) }) }} /><span dir="auto">{line.replace(/^\[[ x]\] /i, '')}</span></label>)}</div>}
            <p className="label">{t.nextStep}</p>
            <p className="next-step" dir="auto">
              {project.nextStep || t.nextStepPlaceholder}
            </p>

            {(project.projectUrl || project.attachmentUrl || project.dueDate) && <div className="project-details">
              {project.dueDate && <p className="project-date"><strong>{t.dueDate}:</strong> <time dateTime={project.dueDate}>{project.dueDate}</time></p>}
              {project.projectUrl && <a href={project.projectUrl} target="_blank" rel="noopener noreferrer">↗ {r.open}</a>}
              {project.attachmentUrl && <a href={project.attachmentUrl} target="_blank" rel="noopener noreferrer">↗ {t.attachmentUrl}</a>}
            </div>}

            <button disabled={!canEdit} type="button" onClick={() => onToggle(project.id)}>
              <span
                key={`${language}-${project.status}`}
                className="button-copy"
              >
                {isActive ? t.postponeProject : t.startProject}
              </span>
            </button>

            <div className="card-actions">
              <button
                disabled={!canEdit}
                ref={editButtonRef}
                type="button"
                className="card-secondary"
                onClick={startEditing}
              >
                {t.editProject}
              </button>

              {canManage && <button
                ref={deleteButtonRef}
                type="button"
                className="card-delete"
                onClick={() => { revisionRef.current = project.revision; setIsDeleteOpen(true) }}
              >
                {t.deleteProject}
              </button>}
            </div>
          </>
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
  )
}

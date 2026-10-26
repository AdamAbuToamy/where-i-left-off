import { markCardViewed } from '../lib/pushNotifications'
import FocusSession from './FocusSession'
import CatalogLookup from './CatalogLookup'
import type { User } from 'firebase/auth'
import { auth } from '../lib/firebase'
import { workflowText } from '../workflowText'
import { cardAction } from '../lib/cardAction'
import ExtraLinks from './ExtraLinks'
import LinkedText from './LinkedText'
import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { Project, Section, GroupMember } from '../types'
import type { Language } from '../translations'
import { translations } from '../translations'
import DeleteProjectDialog from './DeleteProjectDialog'
import './ProjectCard.css'
import { pageText } from '../pageText'
import { groupText } from '../groupTranslations'
import { recallText } from '../recallTranslations'
import { checklistItems } from '../lib/taskOverview'
import { toggleChecklist } from '../lib/projects'
import type { ProjectDetails } from '../lib/projects'
import RecallFields from './RecallFields'
import type { RecallDetails } from './RecallFields'

type ProjectCardProps = {
  project: Project
  sections: Section[]
  language: Language
  groupId?:string
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
  groupId, members, canManage = true, canEdit = true,
  onUpdate,
  onDelete,
}: ProjectCardProps) {
  const t = translations[language], r = recallText[language], g = groupText[language]
  const [metadata, setMetadata] = useState<RecallDetails>({ assignedTo: project.assignedTo, sectionId: project.sectionId, kind: project.kind || 'resume', status: project.status, checkpoint: project.checkpoint, checklist: project.checklist,resourceType:project.resourceType,progressUnits:project.progressUnits,totalUnits:project.totalUnits,followUpDate:project.followUpDate,coverUrl:project.coverUrl,description:project.description,catalogSource:project.catalogSource,catalogId:project.catalogId })
  const [optimisticChecklist, setOptimisticChecklist] = useState<{ revision: number; text: string } | null>(null)
  const checklist = optimisticChecklist?.revision === project.revision ? optimisticChecklist.text : project.checklist ?? ''
  const action = cardAction(project,language)
  const isActive = project.status === 'active'

  const [isEditing, setIsEditing] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [name, setName] = useState(project.name)
  const [nextStep, setNextStep] = useState(project.nextStep)
  const [projectUrl, setProjectUrl] = useState(project.projectUrl ?? '')
  const [attachmentUrl, setAttachmentUrl] = useState(project.attachmentUrl ?? '')
  const [dueDate, setDueDate] = useState(project.dueDate ?? '')
  const [links,setLinks]=useState<string[]>(project.links || [])

  const revisionRef = useRef(project.revision)
  const editButtonRef = useRef<HTMLButtonElement>(null)
  const deleteButtonRef = useRef<HTMLButtonElement>(null)

  function startEditing() {
    void markCardViewed(project.id, groupId)
    revisionRef.current = project.revision
    setMetadata({ assignedTo: project.assignedTo, sectionId: project.sectionId, kind: project.kind || 'resume', status: project.status, checkpoint: project.checkpoint, checklist: project.checklist,resourceType:project.resourceType,progressUnits:project.progressUnits,totalUnits:project.totalUnits,followUpDate:project.followUpDate,coverUrl:project.coverUrl,description:project.description,catalogSource:project.catalogSource,catalogId:project.catalogId })
    setName(project.name)
    setNextStep(project.nextStep)
    setProjectUrl(project.projectUrl ?? '')
    setAttachmentUrl(project.attachmentUrl ?? '')
    setDueDate(project.dueDate ?? '')
    setLinks(project.links || [])
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

    if (!await onUpdate(project.id, name.trim(), nextStep.trim(), { ...metadata, projectUrl: projectUrl.trim(), attachmentUrl: attachmentUrl.trim(), dueDate, links:links.map(url=>url.trim()).filter(Boolean) }, revisionRef.current)) return
    finishEditing()
  }

  return (
    <>
      <article onClick={e=>{if((e.target as HTMLElement).closest('a,button,summary,input'))void markCardViewed(project.id,groupId)}} data-project={project.id} className={`project-card ${isActive ? 'is-active' : ''} is-${project.status}`}>
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

            {canManage&&<CatalogLookup name={name} type={metadata.resourceType} language={language} onChoose={(title,values)=>{setName(title);setMetadata({...metadata,...values});if(values.projectUrl)setProjectUrl(values.projectUrl)}}/>}
            <RecallFields members={members} progressOnly={!canManage} value={metadata} onChange={setMetadata} sections={sections} language={language} prefix={`edit-${project.id}`} />
            <label htmlFor={`url-${project.id}`}>{t.projectUrl}</label>
            <input disabled={!canManage} id={`url-${project.id}`} type="url" inputMode="url" maxLength={500} value={projectUrl} onChange={event => setProjectUrl(event.target.value)} />

            <label htmlFor={`attachment-${project.id}`}>{t.attachmentUrl}</label>
            <input disabled={!canManage} id={`attachment-${project.id}`} type="url" inputMode="url" maxLength={500} value={attachmentUrl} onChange={event => setAttachmentUrl(event.target.value)} />

            <ExtraLinks value={links} onChange={setLinks} language={language} prefix={`edit-${project.id}`} disabled={!canManage}/>
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
            {project.coverUrl&&<img className="card-cover" onError={e=>{e.currentTarget.hidden=true}} src={project.coverUrl} alt="" loading="lazy" referrerPolicy="no-referrer"/>}
            <h2 dir="auto"><LinkedText text={project.name}/></h2>

            {members && <p className="assignment-badge">{g.assigned}: <span dir="auto">{project.assignedTo ? members.find(m => m.uid === project.assignedTo)?.name || g.removed : g.unassigned}</span></p>}
            <div className="card-meta"><span>{r[project.kind || 'resume']}</span><span dir="auto">{sections.find(s => s.id === project.sectionId)?.name || r.noSection}</span></div>
            {project.checkpoint && <><p className="label">{r.checkpoint}</p><p className="checkpoint-copy" dir="auto"><LinkedText text={project.checkpoint}/></p></>}
            {!!checklistItems(checklist).length && <ol className="recall-checklist">{checklistItems(checklist).map((item,number) => <li key={item.index}><label><input type="checkbox" disabled={!canEdit} checked={item.done} onChange={() => { const text=toggleChecklist(checklist,item.index);setOptimisticChecklist({revision:project.revision,text});void onUpdate(project.id,project.name,project.nextStep,{...project,checklist:text},project.revision).then(ok=>{if(!ok)setOptimisticChecklist(null)}) }} /><span className="check-number" aria-hidden="true">{number+1}.</span><span dir="auto"><LinkedText text={item.text}/></span></label></li>)}</ol>}
            {project.catalogSource&&<small className="catalog-credit"><a href={project.catalogSource==='tvmaze'?`https://www.tvmaze.com/shows/${project.catalogId}`:`https://openlibrary.org/works/${project.catalogId}`} target="_blank" rel="noopener noreferrer">{workflowText[language].source}: {project.catalogSource==='tvmaze'?'TVmaze':'Open Library'}</a></small>}
            {project.description&&<details className="resource-description"><summary>{language==='ar'?'الملاحظات والوصف':language==='he'?'הערות ותיאור':'Notes and description'}</summary><p dir="auto"><LinkedText text={project.description}/></p></details>}
            {!!project.totalUnits&&<p className="resource-count">{project.progressUnits || 0} / {project.totalUnits}</p>}
            {project.followUpDate&&<p>{workflowText[language].followUp}: <time dateTime={project.followUpDate}>{project.followUpDate}</time></p>}
            <p className="label">{t.nextStep}</p>
            <p className="next-step" dir="auto">
              <LinkedText text={project.nextStep || t.nextStepPlaceholder}/>
            </p>

            {(project.projectUrl || project.attachmentUrl || project.links?.length || project.dueDate) && <div className="project-details">
              {project.dueDate && <p className="project-date"><strong>{t.dueDate}:</strong> <time dateTime={project.dueDate}>{project.dueDate}</time></p>}
              {project.projectUrl && <a href={project.projectUrl} target="_blank" rel="noopener noreferrer">↗ {r.open}</a>}
              {project.links?.map((url,i)=><a key={i} href={url} target="_blank" rel="noopener noreferrer" dir="ltr">↗ {url}</a>)}
              {project.attachmentUrl && <a href={project.attachmentUrl} target="_blank" rel="noopener noreferrer">↗ {t.attachmentUrl}</a>}
            </div>}

            {canEdit && <button type="button" onClick={() => void onUpdate(project.id,project.name,project.nextStep,{...project,status:action.status},project.revision)}>
              <span
                key={`${language}-${project.status}`}
                className="button-copy"
              >
                {action.label}
              </span>
            </button>}

            {canEdit&&project.status!=='waiting'&&project.resourceType!=='shopping'&&project.resourceType!=='idea'&&auth?.currentUser&&<FocusSession project={project} user={auth.currentUser as User} language={language} groupId={groupId} onSave={(details,revision)=>onUpdate(project.id,project.name,details.nextStep ?? project.nextStep,{...project,...details},revision)}/>}
            {(canEdit || canManage) && <details className="card-options"><summary>{pageText[language].more}</summary><div className="card-actions">
              {canEdit && <button
                ref={editButtonRef}
                type="button"
                className="card-secondary"
                onClick={startEditing}
              >
                {t.editProject}
              </button>}

              {canManage&&<button className="card-secondary" onClick={()=>void onUpdate(project.id,project.name,project.nextStep,{...project,archivedAt:Date.now()},project.revision)}>{workflowText[language].archiveCard}</button>}
              {canManage && <button
                ref={deleteButtonRef}
                type="button"
                className="card-delete"
                onClick={() => { revisionRef.current = project.revision; setIsDeleteOpen(true) }}
              >
                {t.deleteProject}
              </button>}
            </div></details>}
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

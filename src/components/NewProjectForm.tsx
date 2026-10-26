import CatalogLookup from './CatalogLookup'
import ExtraLinks from './ExtraLinks'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { Language } from '../translations'
import { translations } from '../translations'
import { recallText } from '../recallTranslations'
import type { Section, GroupMember } from '../types'
import type { ProjectDetails } from '../lib/projects'
import RecallFields from './RecallFields'
import type { RecallDetails } from './RecallFields'

type NewProjectFormProps = {
  language: Language
  isOpen: boolean
  sections?: Section[]
  members?: GroupMember[]
  defaultSectionId?: string
  defaultAssignedTo?: string
  initialValues?: { name: string; projectUrl: string;checkpoint?:string;resourceType?:'video'|'course' }
  onAdd: (name: string, nextStep: string, details: ProjectDetails) => Promise<boolean>
  onCancel: () => void
}

export default function NewProjectForm({
  language,
  isOpen,
  initialValues,
  sections = [],
  members,
  defaultSectionId = '',
  defaultAssignedTo = '',
  onAdd,
  onCancel,
}: NewProjectFormProps) {
  const t = translations[language], r = recallText[language]
  const [metadata, setMetadata] = useState<RecallDetails>({ assignedTo: defaultAssignedTo, status: 'later', kind: 'resume', sectionId: defaultSectionId, checkpoint: initialValues?.checkpoint || '', checklist: '',resourceType:initialValues?.resourceType || 'project' })
  const inputRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState(() => initialValues?.name ?? '')
  const [nextStep, setNextStep] = useState('')
  const [projectUrl, setProjectUrl] = useState(() => initialValues?.projectUrl ?? '')
  const [attachmentUrl, setAttachmentUrl] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [links,setLinks]=useState<string[]>([])

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus({ preventScroll: true })
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen) window.dispatchEvent(new CustomEvent('tour-fields-ready', { detail: !!name.trim() && !!nextStep.trim() }))
  }, [isOpen, name, nextStep])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!name.trim()) return

    if (!await onAdd(name.trim(), nextStep.trim(), { ...metadata, projectUrl: projectUrl.trim(), attachmentUrl: attachmentUrl.trim(), dueDate, links:links.map(url=>url.trim()).filter(Boolean) })) return
    setName('')
    setNextStep('')
    setProjectUrl('')
    setAttachmentUrl('')
    setDueDate('')
    setLinks([])
    setMetadata({ assignedTo: defaultAssignedTo, status: 'later', kind: 'resume', sectionId: defaultSectionId, checkpoint: '', checklist: '' })
  }

  return (
    <form className="new-project-form" onSubmit={handleSubmit}>
      <h2>{r.newCard}</h2>
      {initialValues && <p className="notice">{r.captured}</p>}

      <label htmlFor="project-name">{r.cardName}</label>

      <input
        ref={inputRef}
        id="project-name"
        dir="auto"
        required
        maxLength={100}
        placeholder={t.projectNamePlaceholder}
        value={name}
        onChange={(event) => setName(event.target.value)}
      />

      <CatalogLookup name={name} type={metadata.resourceType} language={language} onChoose={(title,values)=>{setName(title);setMetadata({...metadata,...values});if(values.projectUrl)setProjectUrl(values.projectUrl)}}/>
      <label htmlFor="project-next-step">{t.nextStep}</label>

      <textarea
        id="project-next-step"
        dir="auto"
        rows={3}
        maxLength={1000}
        placeholder={t.nextStepInputPlaceholder}
        value={nextStep}
        onChange={(event) => setNextStep(event.target.value)}
      />

      <div className="project-extra-fields"><RecallFields members={members} value={metadata} onChange={setMetadata} sections={sections} language={language} prefix="new" />
      <label htmlFor="project-url">{t.projectUrl}</label>
      <input id="project-url" type="url" inputMode="url" maxLength={500} placeholder={t.projectUrlPlaceholder} value={projectUrl} onChange={event => setProjectUrl(event.target.value)} />

      <label htmlFor="project-attachment">{t.attachmentUrl}</label>
      <input id="project-attachment" type="url" inputMode="url" maxLength={500} placeholder={t.attachmentUrlPlaceholder} value={attachmentUrl} onChange={event => setAttachmentUrl(event.target.value)} />

      <ExtraLinks value={links} onChange={setLinks} language={language} prefix="new"/>
      <label htmlFor="project-due-date">{t.dueDate}</label>
      <input id="project-due-date" type="date" value={dueDate} onChange={event => setDueDate(event.target.value)} />

      </div>
      <div className="form-actions">
        <button
          type="submit"
          data-tour="save-project"
          className="primary-button"
          disabled={!name.trim()}
        >
          {r.saveCard}
        </button>

        <button
          type="button"
          className="secondary-button"
          onClick={onCancel}
        >
          {t.cancel}
        </button>
      </div>
    </form>
  )
}

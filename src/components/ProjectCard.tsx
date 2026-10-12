import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { Project } from '../types'
import type { Language } from '../translations'
import { translations } from '../translations'
import DeleteProjectDialog from './DeleteProjectDialog'
import './ProjectCard.css'

type ProjectCardProps = {
  project: Project
  language: Language
  onToggle: (id: string) => void
  onUpdate: (id: string, name: string, nextStep: string, revision: number) => Promise<boolean>
  onDelete: (id: string, revision: number) => Promise<boolean>
}

export default function ProjectCard({
  project,
  language,
  onToggle,
  onUpdate,
  onDelete,
}: ProjectCardProps) {
  const t = translations[language]
  const isActive = project.status === 'active'

  const [isEditing, setIsEditing] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [name, setName] = useState(project.name)
  const [nextStep, setNextStep] = useState(project.nextStep)

  const revisionRef = useRef(project.revision)
  const editButtonRef = useRef<HTMLButtonElement>(null)
  const deleteButtonRef = useRef<HTMLButtonElement>(null)

  function startEditing() {
    revisionRef.current = project.revision
    setName(project.name)
    setNextStep(project.nextStep)
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

    if (!await onUpdate(project.id, name.trim(), nextStep.trim(), revisionRef.current)) return
    finishEditing()
  }

  return (
    <>
      <article className={`project-card ${isActive ? 'is-active' : ''}`}>
        <span
          key={project.status}
          className={`status ${isActive ? 'status-active' : ''}`}
        >
          {isActive ? t.active : t.later}
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

            <p className="label">{t.nextStep}</p>
            <p className="next-step" dir="auto">
              {project.nextStep || t.nextStepPlaceholder}
            </p>

            <button type="button" onClick={() => onToggle(project.id)}>
              <span
                key={`${language}-${project.status}`}
                className="button-copy"
              >
                {isActive ? t.postponeProject : t.startProject}
              </span>
            </button>

            <div className="card-actions">
              <button
                ref={editButtonRef}
                type="button"
                className="card-secondary"
                onClick={startEditing}
              >
                {t.editProject}
              </button>

              <button
                ref={deleteButtonRef}
                type="button"
                className="card-delete"
                onClick={() => { revisionRef.current = project.revision; setIsDeleteOpen(true) }}
              >
                {t.deleteProject}
              </button>
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

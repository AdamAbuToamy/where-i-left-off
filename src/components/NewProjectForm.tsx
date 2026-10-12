import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { Language } from '../translations'
import { translations } from '../translations'

type NewProjectFormProps = {
  language: Language
  isOpen: boolean
  onAdd: (name: string, nextStep: string) => Promise<boolean>
  onCancel: () => void
}

export default function NewProjectForm({
  language,
  isOpen,
  onAdd,
  onCancel,
}: NewProjectFormProps) {
  const t = translations[language]
  const inputRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState('')
  const [nextStep, setNextStep] = useState('')

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus({ preventScroll: true })
    }
  }, [isOpen])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!name.trim()) return

    if (!await onAdd(name.trim(), nextStep.trim())) return
    setName('')
    setNextStep('')
  }

  return (
    <form className="new-project-form" onSubmit={handleSubmit}>
      <h2>{t.addProject}</h2>

      <label htmlFor="project-name">{t.projectName}</label>

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

      <div className="form-actions">
        <button
          type="submit"
          className="primary-button"
          disabled={!name.trim()}
        >
          {t.saveProject}
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
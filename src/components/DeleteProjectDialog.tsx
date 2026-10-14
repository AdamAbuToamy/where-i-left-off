import { useEffect, useRef, useState } from 'react'
import type { Language } from '../translations'
import { translations } from '../translations'
import './DeleteProjectDialog.css'
import { cloudText } from '../cloudTranslations'

type DeleteProjectDialogProps = {
  open: boolean
  projectName: string
  language: Language
  onCancel: () => void
  onConfirm: () => Promise<boolean>
}

const descriptions: Record<Language, string> = {
  ar: 'ستُنقل البطاقة إلى سلة المهملات. يمكنك استرجاعها من الأرشيف والسلة.',
  he: 'הכרטיס יועבר לאשפה. אפשר לשחזר אותו מהארכיון והאשפה.',
  en: 'This card will move to Trash. Restore it from Archive and trash.',
}

export default function DeleteProjectDialog({
  open,
  projectName,
  language,
  onCancel,
  onConfirm,
}: DeleteProjectDialogProps) {
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const t = translations[language]

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open && !dialog.open) {
      dialog.showModal()
      cancelRef.current?.focus()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      className="delete-dialog"
      aria-labelledby="delete-dialog-title"
      aria-describedby="delete-dialog-description"
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) onCancel()
      }}
    >
      <div className="delete-dialog-body">
        <div className="delete-dialog-icon" aria-hidden="true">
          <svg
            width="27"
            height="27"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 6h18" />
            <path d="M9 6V4h6v2" />
            <path d="M5 6l1 14h12l1-14" />
            <path d="M10 10v6M14 10v6" />
          </svg>
        </div>

        <h2 id="delete-dialog-title">{t.deleteConfirmation}</h2>

        <p className="delete-dialog-project" dir="auto">
          {projectName}
        </p>

        <p id="delete-dialog-description">
          {descriptions[language]}
        </p>

        {failed && <p role="alert">{cloudText[language].error}</p>}
        <div className="delete-dialog-actions">
          <button
            ref={cancelRef}
            type="button"
            className="delete-dialog-cancel"
            disabled={busy}
            onClick={onCancel}
          >
            {t.cancel}
          </button>

          <button
            type="button"
            className="delete-dialog-confirm"
            disabled={busy}
            onClick={async () => { setBusy(true); setFailed(false); const ok = await onConfirm(); if (!ok) { setFailed(true); setBusy(false) } }}
          >
            {t.deleteProject}
          </button>
        </div>
      </div>
    </dialog>
  )
}

import { useEffect, useRef, useState } from 'react'
import type { Language } from '../translations'
import { translations } from '../translations'

type LanguagePickerProps = {
  language: Language
  onChange: (language: Language) => void
}

const languages: { code: Language; name: string }[] = [
  { code: 'ar', name: 'العربية' },
  { code: 'he', name: 'עברית' },
  { code: 'en', name: 'English' },
]

export default function LanguagePicker({
  language,
  onChange,
}: LanguagePickerProps) {
  const [isOpen, setIsOpen] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const selectedRef = useRef<HTMLButtonElement>(null)

  const selected = languages.find((item) => item.code === language)!
  const t = translations[language]

  useEffect(() => {
    if (!isOpen) return

    selectedRef.current?.focus()

    function handleOutsideClick(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !containerRef.current?.contains(event.target)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('pointerdown', handleOutsideClick)

    return () => {
      document.removeEventListener('pointerdown', handleOutsideClick)
    }
  }, [isOpen])

  function selectLanguage(value: Language) {
    onChange(value)
    setIsOpen(false)
    triggerRef.current?.focus()
  }

  return (
    <div
      ref={containerRef}
      className="language-picker"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setIsOpen(false)
        }
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          setIsOpen(false)
          triggerRef.current?.focus()
        }
      }}
    >
      <span className="language-label">{t.language}</span>

      <button
        ref={triggerRef}
        type="button"
        className="language-trigger"
        aria-label={`${t.language}: ${selected.name}`}
        aria-expanded={isOpen}
        aria-controls="language-options"
        onClick={() => setIsOpen((current) => !current)}
      >
        <span key={language} className="language-value">
          {selected.name}
        </span>

        <span
          className={`language-chevron ${isOpen ? 'is-open' : ''}`}
          aria-hidden="true"
        >
          ▾
        </span>
      </button>

      <div
        id="language-options"
        className={`language-dropdown ${isOpen ? 'is-open' : ''}`}
        role="group"
        aria-label={t.language}
        inert={!isOpen}
      >
        {languages.map((item) => (
          <button
            key={item.code}
            ref={item.code === language ? selectedRef : undefined}
            type="button"
            className="language-option"
            aria-pressed={item.code === language}
            onClick={() => selectLanguage(item.code)}
          >
            <span lang={item.code}>{item.name}</span>

            <span className="language-check" aria-hidden="true">
              {item.code === language ? '✓' : ''}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
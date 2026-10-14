import { useState } from 'react'
import type { Language } from '../translations'
import { settingsText } from '../settingsText'
import { readTheme, saveTheme, themes } from '../lib/theme'
export default function ThemePicker({ uid, language }: { uid: string; language: Language }) {
 const [theme, setTheme] = useState(() => readTheme(uid)), t = settingsText[language]
 return <section className="settings-section"><h3>{t.appearance}</h3><p>{t.appearanceHint}</p><div className="theme-options" role="group" aria-label={t.appearance}>{themes.map((value, i) => <button key={value} className={`theme-option theme-preview-${value}`} aria-pressed={theme === value} onClick={() => { setTheme(value); saveTheme(uid, value) }}><span className="theme-swatch" aria-hidden="true"><i /><i /><i /></span><span>{t.themes[i]}</span><span aria-hidden="true">{theme === value ? '✓' : ''}</span></button>)}</div></section>
}

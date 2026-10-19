import { isAdmin } from '../lib/admin'
import { useState } from 'react'
import type { User } from 'firebase/auth'
import type { Language } from '../translations'
import ExtensionInstall from './ExtensionInstall'
import { LegalLinks } from './Support'
import SettingsGroup from './SettingsGroup'
import { supportText } from '../supportText'
import { exportPersonalData } from '../lib/feedback'
import WorkflowSettings from './WorkflowSettings'
import PasswordChange from './PasswordChange'
import { SleepPreference } from './IdleSleep'
import ThemePicker from './ThemePicker'
import AccountDeletion from './AccountDeletion'
import { settingsText } from '../settingsText'
import { workflowText } from '../workflowText'
import { db } from '../lib/firebase'
import { saveName, validName } from '../lib/profile'
import { traced } from '../lib/logging'
import { pageText } from '../pageText'
import { tourText } from '../tourText'
import { errorText } from '../cloudTranslations'
const labels = {
  en: { profile: 'Profile', rest: 'Sleep mode and guide', extension: 'Chrome extension' },
  ar: { profile: 'الملف الشخصي', rest: 'وضع السكون ودليل الاستخدام', extension: 'إضافة Chrome' },
  he: { profile: 'פרופיל אישי', rest: 'מצב שינה ומדריך', extension: 'תוסף Chrome' },
}
export default function ProfileSettings({ user, language }: { user: User; language: Language }) {
  const t = pageText[language], a = settingsText[language], l = labels[language], w = workflowText[language], support = supportText[language]
  const [name, setName] = useState(user.displayName || ''), [busy, setBusy] = useState(false), [saved, setSaved] = useState(false), [error, setError] = useState<unknown>(null)
  const [exporting, setExporting] = useState(false), [exportError, setExportError] = useState(false)
  return <section className="page-panel settings-page"><h2>{t.settings}</h2><div className="settings-groups">
    <SettingsGroup title={l.profile}><form className="profile-form" onSubmit={async e => {
      e.preventDefault(); if (busy || !validName(name)) return
      setBusy(true); setError(null); setSaved(false)
      try { await traced('profile.save', () => saveName(db!, user, name)); setSaved(true) } catch (err) { setError(err) } finally { setBusy(false) }
    }}>
      <label htmlFor="profile-name">{t.name}</label><input id="profile-name" autoComplete="name" dir="auto" required maxLength={100} value={name} onChange={e => { setName(e.target.value); setSaved(false) }} />
      <button className="primary-button" disabled={busy || !validName(name)}>{t.save}</button>
      {saved && <p role="status">{t.saved}</p>}{error !== null && <p role="alert">{errorText(error, language)}</p>}
    </form></SettingsGroup>
    <SettingsGroup title={a.account}><section className="settings-section"><h3>{a.account}</h3><div className="settings-account-details"><span dir="auto">{user.email}</span><span className="settings-status">{user.emailVerified ? a.verified : a.notVerified}</span></div></section><PasswordChange user={user} language={language} /></SettingsGroup>
    <SettingsGroup title={a.appearance}><ThemePicker uid={user.uid} language={language} /></SettingsGroup>
    <SettingsGroup title={w.workflow}><WorkflowSettings uid={user.uid} language={language} /></SettingsGroup>
    <SettingsGroup title={l.rest}><SleepPreference uid={user.uid} language={language} /><section className="settings-section tour-settings"><h3>{tourText[language].replay}</h3><button className="secondary-button tour-replay" onClick={() => window.dispatchEvent(new Event('replay-welcome-tour'))}>{tourText[language].replay}</button></section></SettingsGroup>
    <SettingsGroup title={l.extension}><ExtensionInstall language={language} settings admin={isAdmin(user.email, user.emailVerified)} /></SettingsGroup>
    <SettingsGroup title={support.legal}><section className="settings-section"><h3>{support.legal}</h3><p>{support.exportHint}</p><button className="secondary-button" disabled={exporting} onClick={async () => {
      setExporting(true); setExportError(false)
      try {
        const data = await exportPersonalData(db!, user.uid), url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })), anchor = document.createElement('a')
        anchor.href = url; anchor.download = 'where-i-left-off-personal-data.json'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
      } catch { setExportError(true) } finally { setExporting(false) }
    }}>{support.export}</button>{exportError && <p role="alert">{support.exportFailed}</p>}<LegalLinks language={language} /></section></SettingsGroup>
    <SettingsGroup title={a.deletionTitle} danger><AccountDeletion user={user} language={language} /></SettingsGroup>
  </div></section>
}

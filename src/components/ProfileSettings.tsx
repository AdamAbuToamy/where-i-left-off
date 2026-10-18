import ExtensionInstall from './ExtensionInstall'
import { LegalLinks } from './Support'
import { supportText } from '../supportText'
import { exportPersonalData } from '../lib/feedback'
import WorkflowSettings from './WorkflowSettings'
import { useState } from 'react'
import PasswordChange from './PasswordChange'
import { SleepPreference } from './IdleSleep'
import ThemePicker from './ThemePicker'
import AccountDeletion from './AccountDeletion'
import { settingsText } from '../settingsText'
import type { User } from 'firebase/auth'
import type { Language } from '../translations'
import { db } from '../lib/firebase'
import { saveName, validName } from '../lib/profile'
import { traced } from '../lib/logging'
import { pageText } from '../pageText'
import { tourText } from '../tourText'
import { errorText } from '../cloudTranslations'
export default function ProfileSettings({ user, language }: { user: User; language: Language }) {
  const t = pageText[language], a = settingsText[language]
  const [name, setName] = useState(user.displayName || ''), [busy, setBusy] = useState(false), [saved, setSaved] = useState(false), [error, setError] = useState<unknown>(null)
  const [exporting,setExporting]=useState(false),[exportError,setExportError]=useState(false)
  return <section className="page-panel"><h2>{t.settings}</h2><form className="profile-form" onSubmit={async e => { e.preventDefault(); if (busy || !validName(name)) return; setBusy(true); setError(null); setSaved(false); try { await traced('profile.save', () => saveName(db!, user, name)); setSaved(true) } catch (err) { setError(err) } finally { setBusy(false) } }}>
    <label htmlFor="profile-name">{t.name}</label><input id="profile-name" autoComplete="name" dir="auto" required maxLength={100} value={name} onChange={e => { setName(e.target.value); setSaved(false) }} />
    <button className="primary-button" disabled={busy || !validName(name)}>{t.save}</button>
    {saved && <p role="status">{t.saved}</p>}{error !== null && <p role="alert">{errorText(error, language)}</p>}
  </form><ThemePicker uid={user.uid} language={language} /><section className="settings-section"><h3>{a.account}</h3><div className="settings-account-details"><span dir="auto">{user.email}</span><span className="settings-status">{user.emailVerified ? a.verified : a.notVerified}</span></div></section><PasswordChange user={user} language={language} /><WorkflowSettings uid={user.uid} language={language}/><SleepPreference uid={user.uid} language={language}/><section className="settings-section tour-settings"><h3>{tourText[language].replay}</h3><button className="secondary-button tour-replay" onClick={() => window.dispatchEvent(new Event('replay-welcome-tour'))}>{tourText[language].replay}</button></section><ExtensionInstall language={language} settings /><section className="settings-section"><h3>{supportText[language].legal}</h3><p>{supportText[language].exportHint}</p><button className="secondary-button" disabled={exporting} onClick={async()=>{setExporting(true);setExportError(false);try{const data=await exportPersonalData(db!,user.uid),url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='where-i-left-off-personal-data.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}catch{setExportError(true)}finally{setExporting(false)}}}>{supportText[language].export}</button>{exportError&&<p role="alert">{supportText[language].exportFailed}</p>}<LegalLinks language={language}/></section><AccountDeletion user={user} language={language} /></section>
}

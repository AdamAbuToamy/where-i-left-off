import CloudPushSync from './components/CloudPushSync'
import NotificationSettings from './components/NotificationSettings'
import PushLifecycle from './components/PushLifecycle'
import { useInstalledApp, preparePushSignOut } from './lib/pushNotifications'
import { pushText } from './pushText'
import Workspace from './components/Workspace'
import SideNavigation from './components/SideNavigation'
import Support, { LegalLinks } from './components/Support'
import ExtensionInstall from './components/ExtensionInstall'
import { supportText } from './supportText'
import WorkflowAgent from './components/WorkflowAgent'
import LibraryPage from './components/LibraryPage'
import AnalyticsPage from './components/AnalyticsPage'
import { useEffect, useState } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import type { User } from 'firebase/auth'
import LanguagePicker from './components/LanguagePicker'
import AuthPanel from './components/AuthPanel'
import AdminDashboard from './components/AdminDashboard'
import ProfileSettings from './components/ProfileSettings'
import IdleSleep from './components/IdleSleep'
import './Features.css'
import AnnouncementInbox from './components/AnnouncementInbox'
import ContinueNow from './components/ContinueNow'
import WelcomeTour from './components/WelcomeTour'
import { AccountLifecycle } from './components/AccountDeletion'
import { pageText } from './pageText'
import { navigate, usePage } from './lib/navigation'
import { flushLogs, logEvent, traced } from './lib/logging'
import { translations } from './translations'
import type { Language } from './translations'
import { cloudText, errorText } from './cloudTranslations'
import { auth, configured, db, emulatorMode } from './lib/firebase'
import { isAdmin } from './lib/admin'
import './App.css'
import './Cloud.css'
import './Recall.css'
import './Themes.css'
import './Layout.css'
import './Workspace.css'
import './Backgrounds.css'
import { applyTheme } from './lib/theme'
import GroupSpaces from './components/GroupSpaces'

function initialLanguage(): Language {
  try { const value = localStorage.getItem('language'); if (value === 'en' || value === 'he' || value === 'ar') return value } catch { /* Optional preference. */ }
  return 'en'
}
export default function App() {
  const { page, groupId } = usePage()
  const installed = useInstalledApp()
  const [profileVersion, setProfileVersion] = useState(0)
  const [language, setLanguage] = useState<Language>(initialLanguage)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(configured)
  const [authError, setAuthError] = useState<unknown>(null)
  const t = translations[language], c = cloudText[language], p = pageText[language]
  useEffect(() => { applyTheme(user?.uid) }, [user?.uid])
  useEffect(() => { const changed = () => setProfileVersion(v => v + 1); window.addEventListener('profile-updated', changed); return () => window.removeEventListener('profile-updated', changed) }, [])
  useEffect(() => {
    document.documentElement.lang = language
    document.documentElement.dir = language === 'en' ? 'ltr' : 'rtl'
    document.title = 'Where I Left Off — Project Organizer'
    try { localStorage.setItem('language', language) } catch { /* Optional preference. */ }
  }, [language, t.appName])
  useEffect(() => {
    if (!auth) return
    return onAuthStateChanged(auth, current => { setUser(current); setLoading(false); if (current) { void flushLogs(); if (new URLSearchParams(location.search).has('groupInvite')) navigate('groups') } }, e => { setAuthError(e); setLoading(false); logEvent('auth.subscription', e) })
  }, [])
  return <IdleSleep key={user?.uid || 'signed-out'} uid={user?.uid} user={user || undefined} language={language}><main className={`workspace language-${language}`}>
    <PushLifecycle user={user} />
    <header className="page-header"><div className="heading-copy"><h1>{t.appName}</h1></div><div className="header-account-actions"><LanguagePicker language={language} onChange={setLanguage} />{user && <button className="text-button header-signout" onClick={() => void traced('auth.signout', async () => { try { await preparePushSignOut() } catch { /* Local delivery gate is already cleared. */ } await signOut(auth!) }).catch(() => {})}>{c.logout}</button>}</div></header>
    {emulatorMode && <p className="notice">{c.demo}</p>}
    {authError !== null && <p className="notice error" role="alert">{errorText(authError, language)}</p>}
    {!configured ? <section className="empty-state"><h2>{c.setup}</h2><p>{c.setupBody}</p></section> : loading ? <p role="status">{c.loading}</p> : user ? page === 'support' ? <Support key={user.uid} user={user} language={language} initialKind={new URLSearchParams(location.hash.split('?')[1] || '').get('kind')==='deletion'?'deletion':new URLSearchParams(location.hash.split('?')[1] || '').get('kind')==='privacy'?'privacy':'suggestion'} /> : <AccountLifecycle key={user.uid} user={user} language={language}>
      {page !== 'settings' && <ExtensionInstall language={language} />}
      <CloudPushSync key={user.uid} user={user}/><WorkflowAgent user={user} language={language}/><AnnouncementInbox user={user} language={language} />
      <WelcomeTour key={user.uid} user={user} language={language} />
      <SideNavigation language={language} page={page} admin={isAdmin(user.email, user.emailVerified)} />
      {!user.displayName?.trim() && page !== 'settings' && <section className="profile-prompt" aria-label={p.needsName}><span className="profile-prompt-icon" aria-hidden="true">✦</span><div className="profile-prompt-copy"><strong>{p.needsName}</strong><span>{p.profilePrompt}</span></div><a className="primary-button profile-prompt-action" href="#/settings">{p.editProfile} <span aria-hidden="true">↗</span></a></section>}
            {(page === 'personal' || page === 'groups') && <GroupSpaces key={user.uid} user={user} language={language} page={page} groupId={groupId} profileVersion={profileVersion}>{(group, members) => <Workspace key={`${user.uid}/${group?.id || 'personal'}`} user={user} language={language} group={group} members={members} />}</GroupSpaces>}
      {page === 'resume' && <ContinueNow key={user.uid} user={user} language={language} />}
      {page === 'library' && <LibraryPage user={user} language={language}/>}
      {page === 'analytics' && <AnalyticsPage user={user} language={language}/>}
      {page === 'notifications' && (installed ? <NotificationSettings key={user.uid} user={user} language={language} /> : <p>{pushText[language].notInstalled}</p>)}
      {page === 'settings' && <ProfileSettings key={user.uid} user={user} language={language} />}
      {page === 'logs' && isAdmin(user.email, user.emailVerified) && <AdminDashboard db={db!} language={language} user={user} />}
      {page === 'admin' && (isAdmin(user.email, user.emailVerified) ? <AdminDashboard db={db!} language={language} user={user} /> : <p role="alert">{c.signIn}</p>)}
    </AccountLifecycle> : <>{page === 'support' && <p className="notice">{supportText[language].signin}</p>}<AuthPanel language={language} /></>}
    <LegalLinks language={language} />
  </main></IdleSleep>
}

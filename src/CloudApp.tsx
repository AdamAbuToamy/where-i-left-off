import { useEffect, useRef, useState } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import type { User } from 'firebase/auth'
import LanguagePicker from './components/LanguagePicker'
import NewProjectForm from './components/NewProjectForm'
import ProjectBoard from './components/ProjectBoard'
import AuthPanel from './components/AuthPanel'
import { translations } from './translations'
import type { Language } from './translations'
import type { Project } from './types'
import { cloudText, errorText } from './cloudTranslations'
import { auth, configured, db, emulatorMode } from './lib/firebase'
import { addProject, changeProject, watchProjects } from './lib/repository'
import { rankForMove } from './lib/projects'
import './App.css'
import './Cloud.css'

function initialLanguage(): Language {
  try { const value = localStorage.getItem('language'); if (value === 'en' || value === 'he') return value } catch { /* Optional preference. */ }
  return 'ar'
}
function Workspace({ user, language }: { user: User; language: Language }) {
  const t = translations[language], c = cloudText[language]
  const [projects, setProjects] = useState<Project[]>([])
  const [loaded, setLoaded] = useState(false)
  const [cached, setCached] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [subscriptionError, setSubscriptionError] = useState<unknown>(null)
  const [attempt, setAttempt] = useState(0)
  const [pending, setPending] = useState(false)
  const lock = useRef(false)
  const [online, setOnline] = useState(navigator.onLine)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const addButtonRef = useRef<HTMLButtonElement>(null)
  useEffect(() => watchProjects(db!, user.uid, (items, fromCache) => {
    setProjects(items); setCached(fromCache); setLoaded(true); setSubscriptionError(null)
  }, e => setSubscriptionError(e)), [user.uid, attempt])
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update); window.addEventListener('offline', update)
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update) }
  }, [])
  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => { if (lock.current) { e.preventDefault(); e.returnValue = '' } }
    window.addEventListener('beforeunload', guard)
    return () => window.removeEventListener('beforeunload', guard)
  }, [])
  async function run(action: () => Promise<unknown>): Promise<boolean> {
    if (lock.current || !navigator.onLine) return false
    lock.current = true; setPending(true); setError(null)
    try { await action(); return true } catch (e) { setError(e); return false }
    finally { lock.current = false; setPending(false) }
  }
  function closeForm() { setIsFormOpen(false); requestAnimationFrame(() => addButtonRef.current?.focus()) }
  const visible = projects.filter(p => (filter === 'all' || p.status === filter) && `${p.name} ${p.nextStep}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()))
  return <>
    <div className="account-strip">
      <span dir="auto">{user.email || user.displayName}</span>
      <span role="status" className={`sync-status ${pending ? 'is-saving' : ''}`}>{pending ? c.saving : !online ? c.offline : cached ? c.cached : c.saved}</span>
      <button className="text-button" disabled={pending} onClick={() => void run(() => signOut(auth!))}>{c.logout}</button>
    </div>
    {(error !== null || subscriptionError !== null) && <div className="notice error" role="alert">
      {errorText(subscriptionError || error, language)}
      {subscriptionError !== null && <button className="secondary-button" onClick={() => setAttempt(n => n + 1)}>{c.retry}</button>}
    </div>}
    {!loaded && !subscriptionError && <p className="notice" role="status">{c.loading}</p>}
    {loaded && !subscriptionError && <>
      <div className="workspace-toolbar">
        <div className="project-count">{projects.length} {c.count}</div>
        <button ref={addButtonRef} className="primary-button" disabled={pending || !online} aria-expanded={isFormOpen} aria-controls="new-project-panel" onClick={() => isFormOpen ? closeForm() : setIsFormOpen(true)}>
          <span className={`add-icon ${isFormOpen ? 'is-open' : ''}`} aria-hidden="true">+</span>{isFormOpen ? t.cancel : t.addProject}
        </button>
      </div>
      <fieldset className="workspace-fields" disabled={pending || !online} aria-busy={pending}>
        <div id="new-project-panel" className={`form-reveal ${isFormOpen ? 'is-open' : ''}`} inert={!isFormOpen}>
          <div className="form-reveal-inner"><NewProjectForm language={language} isOpen={isFormOpen} onCancel={closeForm} onAdd={async (name, nextStep) => {
            const ok = await run(() => addProject(db!, user.uid, name, nextStep, (projects[0]?.rank ?? 1024) - 1024))
            if (ok) closeForm()
            return ok
          }} /></div>
        </div>
      </fieldset>
      {projects.length > 0 && <div className="search-toolbar">
        <input type="search" aria-label={c.search} placeholder={c.search} value={search} onChange={e => setSearch(e.target.value)} />
        <div className="filter-group">{[['all', c.all], ['active', t.active], ['later', t.later]].map(([value, label]) => <button key={value} className="secondary-button" aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div>
      </div>}
      {!projects.length && <p className="empty-state">{c.empty}</p>}
      {!!projects.length && !visible.length && <p className="empty-state">{c.noResults}</p>}
      <fieldset className="workspace-fields" disabled={pending || !online} aria-busy={pending}>
        <ProjectBoard projects={visible} language={language} onReorder={(activeId, overId) => {
          void run(async () => {
            const project = projects.find(p => p.id === activeId)!
            const rank = rankForMove(projects, activeId, overId)
            if (rank !== null) await changeProject(db!, user.uid, project, 'move', { rank })
          })
        }} onToggle={id => { const p = projects.find(p => p.id === id)!; void run(() => changeProject(db!, user.uid, p, 'toggle')) }}
        onUpdate={(id, name, nextStep, revision) => run(() => changeProject(db!, user.uid, { ...projects.find(p => p.id === id)!, revision }, 'edit', { name, nextStep }))}
        onDelete={(id, revision) => run(() => changeProject(db!, user.uid, { ...projects.find(p => p.id === id)!, revision }, 'delete'))} />
      </fieldset>
    </>}
  </>
}
export default function App() {
  const [language, setLanguage] = useState<Language>(initialLanguage)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(configured)
  const [authError, setAuthError] = useState<unknown>(null)
  const t = translations[language], c = cloudText[language]
  useEffect(() => {
    document.documentElement.lang = language
    document.documentElement.dir = language === 'en' ? 'ltr' : 'rtl'
    document.title = t.appName
    try { localStorage.setItem('language', language) } catch { /* Optional preference. */ }
  }, [language, t.appName])
  useEffect(() => {
    if (!auth) return
    return onAuthStateChanged(auth, current => { setUser(current); setLoading(false) }, e => { setAuthError(e); setLoading(false) })
  }, [])
  return <main className={`workspace language-${language}`}>
    <header className="page-header"><div className="heading-copy"><p>{t.workspace}</p><h1>{t.appName}</h1></div><LanguagePicker language={language} onChange={setLanguage} /></header>
    {emulatorMode && <p className="notice">{c.demo}</p>}
    {authError !== null && <p className="notice error" role="alert">{errorText(authError, language)}</p>}
    {!configured ? <section className="empty-state"><h2>{c.setup}</h2><p>{c.setupBody}</p></section> : loading ? <p role="status">{c.loading}</p> : user ? <Workspace key={user.uid} user={user} language={language} /> : <AuthPanel language={language} />}
  </main>
}

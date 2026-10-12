import { useEffect, useRef, useState } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import type { User } from 'firebase/auth'
import LanguagePicker from './components/LanguagePicker'
import NewProjectForm from './components/NewProjectForm'
import ProjectBoard from './components/ProjectBoard'
import AuthPanel from './components/AuthPanel'
import WeeklySchedule from './components/WeeklySchedule'
import AdminDashboard from './components/AdminDashboard'
import { translations } from './translations'
import type { Language } from './translations'
import type { Project, Section, GroupInfo, GroupMember } from './types'
import { cloudText, errorText } from './cloudTranslations'
import { auth, configured, db, emulatorMode } from './lib/firebase'
import { touchUserMetric, watchUserMetric } from './lib/repository'
import { rankForMove } from './lib/projects'
import { isAdmin } from './lib/admin'
import { parseTabCapture } from './lib/tabCapture'
import './App.css'
import './Cloud.css'
import './Recall.css'
import Sections from './components/Sections'
import { recallText } from './recallTranslations'
import { matchesView } from './lib/projects'
import { OfflineWorkspace } from './lib/offlineWorkspace'
import type { LocalEntity, Mutation } from './lib/offlineStore'
import GroupSpaces from './components/GroupSpaces'
import { groupText } from './groupTranslations'
import { offlineText } from './offlineTranslations'

function initialLanguage(): Language {
  try { const value = localStorage.getItem('language'); if (value === 'en' || value === 'he') return value } catch { /* Optional preference. */ }
  return 'ar'
}
function Workspace({ user, language, group, members }: { user: User; language: Language; group?: GroupInfo; members: GroupMember[] }) {
  const t = translations[language], c = cloudText[language], r = recallText[language], o = offlineText[language]
  const canManage = !group || group.role === 'manager'
  const membership = members.find(m => m.uid === user.uid)
  const canCreate = canManage || !!membership && membership.canCreate !== false
  const g = groupText[language]
  const [onlyMine, setOnlyMine] = useState(false)
  const [sections, setSections] = useState<Section[]>([])
  const [sectionFilter, setSectionFilter] = useState('all')
  const [projects, setProjects] = useState<Project[]>([])
  const [accountSuspended, setAccountSuspended] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [cached, setCached] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [syncError, setSyncError] = useState<unknown>(null)
  const [queued, setQueued] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [conflicts, setConflicts] = useState<Mutation[]>([])
  const repository = useRef<OfflineWorkspace | null>(null)
  const [pending, setPending] = useState(false)
  const lock = useRef(false)
  const [online, setOnline] = useState(navigator.onLine)
  const [capture, setCapture] = useState(() => parseTabCapture(window.location.search))
  const [newSection, setNewSection] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(() => parseTabCapture(window.location.search) !== null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [view, setView] = useState<'board' | 'week' | 'admin'>('board')
  const admin = isAdmin(user.email, user.emailVerified)
  const addButtonRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const workspace = new OfflineWorkspace(db!, user.uid, () => auth!.currentUser?.uid === user.uid, state => {
      setProjects(state.projects); setSections(state.sections); setCached(state.cached); setQueued(state.queued); setSyncing(state.syncing); setConflicts(state.conflicts); setSyncError(state.error); setLoaded(true)
    }, group?.id)
    repository.current = workspace
    const stop = workspace.start()
    return () => { stop(); repository.current = null }
  }, [user.uid, group?.id])
  useEffect(() => { void touchUserMetric(db!, user.uid, user.email ?? '').catch(() => { /* Aggregate stats must never block project use. */ }) }, [user.uid, user.email])
  useEffect(() => watchUserMetric(db!, user.uid, metric => setAccountSuspended(metric?.suspended === true), () => { /* Project access rules remain the final check. */ }), [user.uid])
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
    if (lock.current) return false
    lock.current = true; setPending(true); setError(null)
    try { await action(); return true } catch (e) { setError(e); return false }
    finally { lock.current = false; setPending(false) }
  }
  function describeVersion(entity: LocalEntity | null) {
    if (!entity) return o.deleted
    return [entity.name, 'nextStep' in entity ? entity.nextStep : '', 'checkpoint' in entity ? entity.checkpoint : '', 'checklist' in entity ? entity.checklist : ''].filter(Boolean).join('\n')
  }
  function closeForm() {
    setIsFormOpen(false)
    if (capture) {
      window.history.replaceState({}, '', `${window.location.pathname}${window.location.hash}`)
      setCapture(null)
    }
    requestAnimationFrame(() => addButtonRef.current?.focus())
  }
  const visible = projects.filter(p => (!onlyMine || p.assignedTo === user.uid) && matchesView(p, filter) && (sectionFilter === 'all' || (sections.some(s => s.id === p.sectionId) ? p.sectionId : '') === sectionFilter) && `${p.name} ${p.nextStep} ${p.checkpoint ?? ''} ${p.checklist ?? ''} ${p.projectUrl ?? ''} ${p.attachmentUrl ?? ''}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()))
  return <>
    <div className="account-strip">
      <span className="account-identity" dir="auto">{user.email || user.displayName}</span>
      <span role="status" className={`sync-status ${pending ? 'is-saving' : ''}`}>{pending ? c.saving : !online ? `${c.offline} ${queued ? `(${queued} ${o.queued})` : ''}` : queued ? `${syncing ? o.syncing : o.local} (${queued} ${o.queued})` : cached ? c.cached : c.saved}</span>
      <button className="text-button" disabled={pending} onClick={() => void run(() => signOut(auth!))}>{c.logout}</button>
    </div>
    {!accountSuspended && (error !== null || syncError !== null) && <div className="notice error" role="alert">
      {error ? errorText(error, language) : queued ? `${o.local}. ${errorText(syncError, language)}` : errorText(syncError, language)}
      {syncError !== null && <button className="secondary-button" onClick={() => repository.current?.retry()}>{c.retry}</button>}
    </div>}
    {!accountSuspended && conflicts.map(op => { const local = (op.entity === 'project' ? projects : sections).find(item => item.id === op.entityId) || null; return <section className="notice sync-conflict" role="alert" key={op.id}>
      <h2 dir="auto">{local?.name || op.before?.name}</h2><p>{o.conflict}</p>
      <div className="conflict-versions"><div><strong>{o.localVersion}</strong><p dir="auto">{describeVersion(local)}</p></div><div><strong>{o.cloudVersion}</strong><p dir="auto">{describeVersion(op.conflict?.remote || null)}</p></div></div>
      <button className="primary-button" disabled={pending} onClick={() => void run(() => repository.current!.resolve(op.id, 'local'))}>{o.keepLocal}</button>
      <button className="secondary-button" disabled={pending} onClick={() => void run(() => repository.current!.resolve(op.id, 'remote'))}>{o.keepCloud}</button>
    </section> })}
    {accountSuspended ? <section className="empty-state account-suspended" role="alert"><h2>{t.accountStatus}</h2><p>{t.accountSuspended}</p><button className="secondary-button" onClick={() => void signOut(auth!)}>{c.logout}</button></section> : !loaded && <p className="notice" role="status">{c.loading}</p>}
    {!accountSuspended && loaded && <>
      <div className="workspace-toolbar">
        <div className="project-count">{projects.length} {r.cards}</div>
        {canCreate && <button ref={addButtonRef} className="primary-button" disabled={pending} aria-expanded={isFormOpen} aria-controls="new-project-panel" onClick={() => { if (isFormOpen) closeForm(); else { setNewSection(sectionFilter === 'all' ? '' : sectionFilter); setIsFormOpen(true) } }}>
          <span className={`add-icon ${isFormOpen ? 'is-open' : ''}`} aria-hidden="true">+</span>{isFormOpen ? t.cancel : r.newCard}
        </button>}
      </div>
      <nav className="view-tabs" aria-label={t.workspace}>
        <button className="secondary-button" aria-pressed={view === 'board'} onClick={() => setView('board')}>{t.boardView}</button>
        <button className="secondary-button" aria-pressed={view === 'week'} onClick={() => setView('week')}>{t.weekView}</button>
        {admin && <button className="secondary-button" aria-pressed={view === 'admin'} disabled={!online} onClick={() => setView('admin')}>{t.admin}</button>}
      </nav>
      {group && <div className="filter-group"><button className="secondary-button" aria-pressed={!onlyMine} onClick={() => setOnlyMine(false)}>{g.all}</button><button className="secondary-button" aria-pressed={onlyMine} onClick={() => setOnlyMine(true)}>{g.mine}</button></div>}
      <Sections canManage={canManage} sections={sections} projects={projects} selected={sectionFilter} onSelect={setSectionFilter} language={language} disabled={pending} onSave={(name, id) => run(() => repository.current!.saveSection(name, id))} onDelete={id => run(() => repository.current!.deleteSection(id))} />
      <fieldset className="workspace-fields" disabled={pending} aria-busy={pending}>
        {canCreate && <div id="new-project-panel" className={`form-reveal ${isFormOpen ? 'is-open' : ''}`} inert={!isFormOpen}>
          <div className="form-reveal-inner"><NewProjectForm key={capture ? 'tab-capture' : `manual-${newSection}`} language={language} sections={sections} members={group ? canManage ? members : members.filter(m => m.uid === user.uid) : undefined} defaultAssignedTo={group && !canManage ? user.uid : ''} defaultSectionId={newSection} isOpen={isFormOpen} initialValues={capture ?? undefined} onCancel={closeForm} onAdd={async (name, nextStep, details) => {
            const ok = await run(() => { if (!canCreate) throw new Error('permission-denied'); return repository.current!.add(name, nextStep, (projects[0]?.rank ?? 1024) - 1024, group && !canManage ? { ...details, assignedTo: user.uid } : details) })
            if (ok) { setSearch(''); setFilter('all'); setSectionFilter(details.sectionId || ''); closeForm() }
            return ok
          }} /></div>
        </div>}
      </fieldset>
      {projects.length > 0 && <div className="search-toolbar">
        <input type="search" aria-label={c.search} placeholder={c.search} value={search} onChange={e => setSearch(e.target.value)} />
        <div className="filter-group">{[['all', r.all], ['today', r.today], ['waiting', r.waiting], ['overdue', r.overdue], ['upcoming', r.upcoming], ['active', r.active], ['later', r.later], ['done', r.done]].map(([value, label]) => <button key={value} className="secondary-button" aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div>
      </div>}
      {!projects.length && <p className="empty-state">{c.empty}</p>}
      {!!projects.length && !visible.length && <p className="empty-state">{r.empty}</p>}
      {view === 'week' && <WeeklySchedule projects={visible} language={language} />}
      {view === 'admin' && admin && <AdminDashboard db={db!} language={language} />}
      <fieldset className="workspace-fields" disabled={pending} aria-busy={pending}>
        {view === 'board' && <ProjectBoard members={group ? members : undefined} currentUid={user.uid} canManage={canManage} projects={visible} sections={sections} language={language} onReorder={(activeId, overId) => {
          void run(async () => {
            const project = projects.find(p => p.id === activeId)!
            const rank = rankForMove(projects, activeId, overId)
            if (rank !== null) await repository.current!.change(project, 'move', { rank })
          })
        }} onToggle={id => { const p = projects.find(p => p.id === id)!; void run(() => repository.current!.change(p, 'toggle')) }}
        onUpdate={(id, name, nextStep, details, revision) => run(() => { const current = projects.find(p => p.id === id)!; if (!canManage && current.assignedTo !== user.uid) throw new Error('permission-denied'); return repository.current!.change({ ...current, revision }, 'edit', canManage ? { name, nextStep, ...details } : { name: current.name, nextStep, status: details.status ?? current.status, checkpoint: details.checkpoint ?? current.checkpoint, checklist: details.checklist ?? current.checklist }) })}
        onDelete={(id, revision) => run(() => repository.current!.change({ ...projects.find(p => p.id === id)!, revision }, 'delete'))} />
        }
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
    {!configured ? <section className="empty-state"><h2>{c.setup}</h2><p>{c.setupBody}</p></section> : loading ? <p role="status">{c.loading}</p> : user ? <GroupSpaces key={user.uid} user={user} language={language}>{(group, members) => <Workspace key={`${user.uid}/${group?.id || 'personal'}`} user={user} language={language} group={group} members={members} />}</GroupSpaces> : <AuthPanel language={language} />}
  </main>
}

import CaptureCheckpoint from './components/CaptureCheckpoint'
import WorkflowAgent from './components/WorkflowAgent'
import LibraryPage from './components/LibraryPage'
import AnalyticsPage from './components/AnalyticsPage'
import { workflowText } from './workflowText'
import { canonicalCaptureUrl,currentCard } from './lib/workflow'
import { useEffect, useRef, useState } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import type { User } from 'firebase/auth'
import LanguagePicker from './components/LanguagePicker'
import NewProjectForm from './components/NewProjectForm'
import ProjectBoard from './components/ProjectBoard'
import AuthPanel from './components/AuthPanel'
import WeeklySchedule from './components/WeeklySchedule'
import AdminDashboard from './components/AdminDashboard'
import ProfileSettings from './components/ProfileSettings'
import IdleSleep from './components/IdleSleep'
import './Features.css'
import AnnouncementInbox from './components/AnnouncementInbox'
import ContinueNow from './components/ContinueNow'
import SummaryPdfButton from './components/SummaryPdfButton'
import { featureText } from './featureText'
import WelcomeTour from './components/WelcomeTour'
import { AccountLifecycle } from './components/AccountDeletion'
import { pageText } from './pageText'
import type { PageName } from './lib/navigation'
import { navigate, usePage } from './lib/navigation'
import { displayName } from './lib/profile'
import { flushLogs, logEvent, traced } from './lib/logging'
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
import './Themes.css'
import { applyTheme } from './lib/theme'
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
  const [view, setView] = useState<'board' | 'week'>('board')
  const addButtonRef = useRef<HTMLButtonElement>(null)
  const autoCaptured = useRef(false)
  const workspaceMounted = useRef(true)
  useEffect(()=>{workspaceMounted.current=true;return()=>{workspaceMounted.current=false}},[])
  useEffect(() => {
    const workspace = new OfflineWorkspace(db!, user.uid, () => auth!.currentUser?.uid === user.uid, state => {
      setProjects(state.projects.filter(currentCard)); setSections(state.sections); setCached(state.cached); setQueued(state.queued); setSyncing(state.syncing); setConflicts(state.conflicts); setSyncError(state.error); setLoaded(true); if (state.error) logEvent('workspace.sync', state.error)
    }, group?.id)
    repository.current = workspace
    const stop = workspace.start()
    return () => { stop(); repository.current = null }
  }, [user.uid, group?.id])
  useEffect(() => {
    if(group || !loaded || !capture || (cached && navigator.onLine) || autoCaptured.current || new URLSearchParams(location.search).get('auto')!=='1' || lock.current)return
    autoCaptured.current=true
    void Promise.resolve().then(async()=>{
      if(!workspaceMounted.current || !repository.current)return
      lock.current=true;setPending(true);setError(null)
      try {
        const match=projects.find(project=>canonicalCaptureUrl(project.projectUrl || '')===canonicalCaptureUrl(capture.projectUrl))
        if(match)await repository.current.change(match,'edit',{...match,projectUrl:capture.projectUrl,checkpoint:capture.checkpoint || match.checkpoint,resourceType:capture.resourceType || match.resourceType})
        else await repository.current.add(capture.name,'',(projects[0]?.rank ?? 1024)-1024,{projectUrl:capture.projectUrl,checkpoint:capture.checkpoint || '',resourceType:capture.resourceType || 'project',status:'later'})
        if(workspaceMounted.current){setIsFormOpen(false);setCapture(null);window.history.replaceState({},'',`${location.pathname}${location.hash}`);window.dispatchEvent(new Event('tour-project-created'))}
      }catch(error){if(workspaceMounted.current)setError(error);logEvent('capture.auto-save',error)}
      finally{lock.current=false;if(workspaceMounted.current)setPending(false)}
    })
  },[group,loaded,capture,cached,projects])
  useEffect(() => { void touchUserMetric(db!, user.uid, user.email ?? '').catch(() => { /* Aggregate stats must never block project use. */ }) }, [user.uid, user.email])
  useEffect(() => {
    if (!loaded) return
    const parts=location.hash.replace(/^#\/?/,'').split('/'),id=parts[0]==='groups' ? parts[2] : parts[1]
    if (!id || !/^[A-Za-z0-9]{20}$/.test(id)) return
    const element=document.querySelector<HTMLElement>(`[data-project="${id}"]`)
    element?.scrollIntoView({block:'center',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'})
    element?.classList.add('is-highlighted')
    const timer=window.setTimeout(()=>element?.classList.remove('is-highlighted'),2200)
    return ()=>window.clearTimeout(timer)
  },[loaded,projects.length])
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
  async function run(action: () => Promise<unknown>, event = 'workspace.action'): Promise<boolean> {
    if (lock.current) return false
    lock.current = true; setPending(true); setError(null)
    try { await traced(event, action); return true } catch (e) { setError(e); return false }
    finally { lock.current = false; setPending(false) }
  }
  function describeVersion(entity: LocalEntity | null) {
    if (!entity) return o.deleted
    return [entity.name, 'nextStep' in entity ? entity.nextStep : '', 'checkpoint' in entity ? entity.checkpoint : '', 'checklist' in entity ? entity.checklist : ''].filter(Boolean).join('\n')
  }
  function closeForm() {
    setIsFormOpen(false)
    if (!group) window.dispatchEvent(new Event('tour-form-closed'))
    if (capture) {
      window.history.replaceState({}, '', `${window.location.pathname}${window.location.hash}`)
      setCapture(null)
    }
    requestAnimationFrame(() => addButtonRef.current?.focus())
  }
  const visible = projects.filter(p => (filter==='ideas'?p.resourceType==='idea':p.resourceType!=='idea') && (!onlyMine || p.assignedTo === user.uid) && (filter==='ideas' || matchesView(p, filter)) && (sectionFilter === 'all' || (sections.some(s => s.id === p.sectionId) ? p.sectionId : '') === sectionFilter) && `${p.name} ${p.nextStep} ${p.checkpoint ?? ''} ${p.checklist ?? ''} ${p.projectUrl ?? ''} ${p.attachmentUrl ?? ''} ${p.links?.join(' ') || ''}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()))
  return <>
    <div className="account-strip">
      <span className="account-identity" dir="auto">{displayName(user)}</span>
      <span role="status" className={`sync-status ${pending ? 'is-saving' : ''}`}>{pending ? c.saving : !online ? `${c.offline} ${queued ? `(${queued} ${o.queued})` : ''}` : queued ? `${syncing ? o.syncing : o.local} (${queued} ${o.queued})` : cached ? c.cached : c.saved}</span>
    </div>
    {!accountSuspended&&loaded&&capture&&<CaptureCheckpoint capture={capture} projects={projects} language={language} busy={pending} onNew={()=>setIsFormOpen(true)} onUpdate={project=>void run(()=>repository.current!.change(project,'edit',{...project,projectUrl:capture.projectUrl,checkpoint:capture.checkpoint,resourceType:capture.resourceType || project.resourceType}),'capture.update').then(ok=>{if(ok)closeForm()})}/>}
    {!accountSuspended && (error !== null || syncError !== null) && <div className="notice error" role="alert">
      {error ? errorText(error, language) : queued ? `${o.local}. ${errorText(syncError, language)}` : errorText(syncError, language)}
      {isAdmin(user.email, user.emailVerified) && <a className="text-button" href="#/admin/logs">{pageText[language].logs}</a>}
      {syncError !== null && <button className="secondary-button" onClick={() => repository.current?.retry()}>{c.retry}</button>}
    </div>}
    {!accountSuspended && conflicts.map(op => { const local = (op.entity === 'project' ? projects : sections).find(item => item.id === op.entityId) || null; return <section className="notice sync-conflict" role="alert" key={op.id}>
      <h2 dir="auto">{local?.name || op.before?.name}</h2><p>{o.conflict}</p>
      <div className="conflict-versions"><div><strong>{o.localVersion}</strong><p dir="auto">{describeVersion(local)}</p></div><div><strong>{o.cloudVersion}</strong><p dir="auto">{describeVersion(op.conflict?.remote || null)}</p></div></div>
      <button className="primary-button" disabled={pending} onClick={() => void run(() => repository.current!.resolve(op.id, 'local'))}>{o.keepLocal}</button>
      <button className="secondary-button" disabled={pending} onClick={() => void run(() => repository.current!.resolve(op.id, 'remote'))}>{o.keepCloud}</button>
    </section> })}
    {accountSuspended ? <section className="empty-state account-suspended" role="alert"><h2>{t.accountStatus}</h2><p>{t.accountSuspended}</p></section> : !loaded && <p className="notice" role="status">{c.loading}</p>}
    {!accountSuspended && loaded && <>
      {view === 'board' && <div className="workspace-toolbar">
        <div className="project-count">{projects.length} {r.cards}</div>
        {canCreate && <button data-tour="add-project" ref={addButtonRef} className="primary-button" disabled={pending} aria-expanded={isFormOpen} aria-controls="new-project-panel" onClick={() => { if (isFormOpen) closeForm(); else { setNewSection(sectionFilter === 'all' ? '' : sectionFilter); setIsFormOpen(true); if (!group) window.dispatchEvent(new Event('tour-form-opened')) } }}>
          <span className={`add-icon ${isFormOpen ? 'is-open' : ''}`} aria-hidden="true">+</span>{isFormOpen ? t.cancel : r.newCard}
        </button>}
      </div>}
      {(projects.length > 0 || view === 'week') && <nav className="view-tabs" aria-label={t.workspace}>
        <button className="secondary-button" aria-pressed={view === 'board'} onClick={() => setView('board')}>{t.boardView}</button>
        <button className="secondary-button" aria-pressed={view === 'week'} onClick={() => setView('week')}>{t.weekView}</button>
      </nav>}
      {group && projects.length > 0 && <div className="filter-group"><button className="secondary-button" aria-pressed={!onlyMine} onClick={() => setOnlyMine(false)}>{g.all}</button><button className="secondary-button" aria-pressed={onlyMine} onClick={() => setOnlyMine(true)}>{g.mine}</button></div>}
      {view === 'board' && <Sections canManage={canManage} sections={sections} projects={projects} selected={sectionFilter} onSelect={setSectionFilter} language={language} disabled={pending} onSave={(name, id) => run(() => repository.current!.saveSection(name, id), 'section.save')} onDelete={id => run(() => repository.current!.deleteSection(id), 'section.delete')} />}
      <fieldset className="workspace-fields" disabled={pending} aria-busy={pending}>
        {canCreate && view === 'board' && <div id="new-project-panel" className={`form-reveal ${isFormOpen ? 'is-open' : ''}`} inert={!isFormOpen}>
          <div className="form-reveal-inner"><NewProjectForm key={capture ? 'tab-capture' : `manual-${newSection}`} language={language} sections={sections} members={group ? canManage ? members : members.filter(m => m.uid === user.uid) : undefined} defaultAssignedTo={group && !canManage ? user.uid : ''} defaultSectionId={newSection} isOpen={isFormOpen} initialValues={capture ?? undefined} onCancel={closeForm} onAdd={async (name, nextStep, details) => {
            const ok = await run(() => { if (!canCreate) throw new Error('permission-denied'); return repository.current!.add(name, nextStep, (projects[0]?.rank ?? 1024) - 1024, group && !canManage ? { ...details, assignedTo: user.uid } : details) }, 'project.create')
            if (ok) { setSearch(''); setFilter('all'); setSectionFilter(details.sectionId || ''); closeForm(); if (!group) window.dispatchEvent(new Event('tour-project-created')) }
            return ok
          }} /></div>
        </div>}
      </fieldset>
      {projects.length > 0 && <section className="workspace-report"><div><h3>{featureText[language].report}</h3><p>{group?.name || pageText[language].personal} · {projects.length} {r.cards}</p></div><SummaryPdfButton entries={projects.map(project=>({project,scope:group?.name || pageText[language].personal,groupId:group?.id}))} title={group?.name || featureText[language].report} userName={user.displayName || ''} language={language} cached={cached || queued>0} scopeLabel /></section>}
      {projects.length > 0 && <div className="search-toolbar">
        <input type="search" aria-label={c.search} placeholder={c.search} value={search} onChange={e => setSearch(e.target.value)} />
        <div className="filter-group"><select aria-label={r.all} value={filter} onChange={e => setFilter(e.target.value)}>{[['all', r.all], ['today', r.today], ['waiting', r.waiting], ['overdue', r.overdue], ['upcoming', r.upcoming], ['active', r.active], ['later', r.later], ['done', r.done], ['ideas',workflowText[language].ideas]].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
      </div>}
      {!projects.length && <p className="empty-state">{c.empty}</p>}
      {!!projects.length && !visible.length && <p className="empty-state">{r.empty}</p>}
      {view === 'week' && <WeeklySchedule projects={visible} language={language} />}
      <fieldset className="workspace-fields" disabled={pending} aria-busy={pending}>
        {view === 'board' && <ProjectBoard groupId={group?.id} members={group ? members : undefined} currentUid={user.uid} canManage={canManage} projects={visible} sections={sections} language={language} onReorder={(activeId, overId) => {
          void run(async () => {
            const project = projects.find(p => p.id === activeId)!
            const rank = rankForMove(projects, activeId, overId)
            if (rank !== null) await repository.current!.change(project, 'move', { rank })
          }, 'project.reorder')
        }} onToggle={id => { const p = projects.find(p => p.id === id)!; void run(() => repository.current!.change(p, 'toggle'), 'project.status') }}
        onUpdate={(id, name, nextStep, details, revision) => run(() => { const current = projects.find(p => p.id === id)!; if (!canManage && current.assignedTo !== user.uid) throw new Error('permission-denied'); return repository.current!.change({ ...current, revision }, 'edit', canManage ? { name, nextStep, ...details } : { name: current.name, nextStep, status: details.status ?? current.status, checkpoint: details.checkpoint ?? current.checkpoint, checklist: details.checklist ?? current.checklist,progressUnits:details.progressUnits ?? current.progressUnits,followUpDate:details.followUpDate ?? current.followUpDate }) }, 'project.edit')}
        onDelete={(id, revision) => run(() => repository.current!.change({ ...projects.find(p => p.id === id)!, revision }, 'edit', {...projects.find(p => p.id === id)!,trashedAt:Date.now()}), 'project.delete')} />
        }
      </fieldset>
    </>}
  </>
}
export default function App() {
  const { page, groupId } = usePage()
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
    document.title = t.appName
    try { localStorage.setItem('language', language) } catch { /* Optional preference. */ }
  }, [language, t.appName])
  useEffect(() => {
    if (!auth) return
    return onAuthStateChanged(auth, current => { setUser(current); setLoading(false); if (current) { void flushLogs(); if (new URLSearchParams(location.search).has('groupInvite')) navigate('groups') } }, e => { setAuthError(e); setLoading(false); logEvent('auth.subscription', e) })
  }, [])
  return <IdleSleep key={user?.uid || 'signed-out'} uid={user?.uid} user={user || undefined} language={language}><main className={`workspace language-${language}`}>
    <header className="page-header"><div className="heading-copy"><p>{t.workspace}</p><h1>{t.appName}</h1></div><div className="header-account-actions"><LanguagePicker language={language} onChange={setLanguage} />{user && <button className="text-button header-signout" onClick={() => void traced('auth.signout', () => signOut(auth!)).catch(() => {})}>{c.logout}</button>}</div></header>
    {emulatorMode && <p className="notice">{c.demo}</p>}
    {authError !== null && <p className="notice error" role="alert">{errorText(authError, language)}</p>}
    {!configured ? <section className="empty-state"><h2>{c.setup}</h2><p>{c.setupBody}</p></section> : loading ? <p role="status">{c.loading}</p> : user ? <AccountLifecycle key={user.uid} user={user} language={language}>
      <WorkflowAgent user={user} language={language}/><AnnouncementInbox user={user} language={language} />
      <WelcomeTour key={user.uid} user={user} language={language} />
      <nav className="page-navigation" aria-label={t.workspace}>{(['resume', 'personal', 'groups', 'library', 'analytics', 'settings', ...(isAdmin(user.email, user.emailVerified) ? ['admin'] : [])] as PageName[]).map(item => <a key={item} href={`#/${item}`} aria-current={page === item ? 'page' : undefined}>{item==='library'?workflowText[language].library:item==='analytics'?workflowText[language].analytics:p[item as keyof typeof p]}</a>)}</nav>
      {!user.displayName?.trim() && page !== 'settings' && <section className="profile-prompt" aria-label={p.needsName}><span className="profile-prompt-icon" aria-hidden="true">✦</span><div className="profile-prompt-copy"><strong>{p.needsName}</strong><span>{p.profilePrompt}</span></div><a className="primary-button profile-prompt-action" href="#/settings">{p.editProfile} <span aria-hidden="true">↗</span></a></section>}
            {(page === 'personal' || page === 'groups') && <GroupSpaces key={user.uid} user={user} language={language} page={page} groupId={groupId} profileVersion={profileVersion}>{(group, members) => <Workspace key={`${user.uid}/${group?.id || 'personal'}`} user={user} language={language} group={group} members={members} />}</GroupSpaces>}
      {page === 'resume' && <ContinueNow key={user.uid} user={user} language={language} />}
      {page === 'library' && <LibraryPage user={user} language={language}/>}
      {page === 'analytics' && <AnalyticsPage user={user} language={language}/>}
      {page === 'settings' && <ProfileSettings key={user.uid} user={user} language={language} />}
      {page === 'logs' && isAdmin(user.email, user.emailVerified) && <AdminDashboard db={db!} language={language} user={user} />}
      {page === 'admin' && (isAdmin(user.email, user.emailVerified) ? <AdminDashboard db={db!} language={language} user={user} /> : <p role="alert">{c.signIn}</p>)}
    </AccountLifecycle> : <AuthPanel language={language} />}
  </main></IdleSleep>
}

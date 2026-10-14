import { sameProjectBaseline } from './projectBaseline'
import { completionDates,shouldArchive } from './workflow'
import { collection, doc, getDocFromServer, runTransaction, serverTimestamp } from 'firebase/firestore'
import type { Firestore } from 'firebase/firestore'
import type { Project, Section } from '../types'
import type { ProjectDetails } from './projects'
import { validateProject } from './projects'
import { watchProjects, watchSections } from './repository'
import { emptyState, listenLocal, nextMutation, normalizedProject, normalizedSection, projectedState, readLocal, updateLocal } from './offlineStore'
import type { LocalEntity, Mutation, OfflineState } from './offlineStore'

export type OfflineSnapshot = ReturnType<typeof projectedState> & { queued: number; syncing: boolean; conflicts: Mutation[]; error: unknown; cached: boolean }
export class OfflineWorkspace {
  private state: OfflineState = emptyState()
  private stopped = false
  private syncing = false
  private failure: unknown = null
  private cached = true
  private retryAt = 0
  private stops: (() => void)[] = []
  readonly key: string
  private db: Firestore
  private uid: string
  private groupId?: string
  private isCurrentUser: () => boolean
  private receive: (snapshot: OfflineSnapshot) => void
  constructor(db: Firestore, uid: string, isCurrentUser: () => boolean, receive: (snapshot: OfflineSnapshot) => void, groupId?: string) {
    this.groupId = groupId
    this.db = db; this.uid = uid; this.isCurrentUser = isCurrentUser; this.receive = receive
    this.key = `${db.app.options.projectId}/${uid}${groupId ? `/group/${groupId}` : ''}`
  }
  start() {
    this.stops.push(listenLocal(this.key, () => { void this.refresh().catch(error => this.fail(error)) }))
    const resume = () => { this.retryAt = 0; void this.flush() }
    window.addEventListener('online', resume)
    this.stops.push(() => window.removeEventListener('online', resume))
    const interval = window.setInterval(() => { void this.flush() }, 10000)
    this.stops.push(() => clearInterval(interval))
    void this.refresh().then(() => {
      if (this.stopped) return
      this.stops.push(watchProjects(this.db, this.uid, (projects, cached) => {
        this.cached = cached
        if (!cached) void updateLocal(this.key, state => ({ ...state, projects: projects.map(p => normalizedProject(p.id, p)) })).catch(error => this.fail(error))
        else this.publish()
      }, error => this.fail(error), this.groupId))
      this.stops.push(watchSections(this.db, this.uid, (sections, cached) => {
        if (!cached) void updateLocal(this.key, state => ({ ...state, sections: sections.map(s => normalizedSection(s.id, s)) })).catch(error => this.fail(error))
      }, error => this.fail(error), this.groupId))
    }).catch(error => this.fail(error))
    return () => { this.stopped = true; this.stops.forEach(stop => stop()) }
  }
  private publish() {
    if (!this.stopped) this.receive({ ...projectedState(this.state), queued: this.state.operations.length, syncing: this.syncing, conflicts: this.state.operations.filter(op => op.conflict), error: this.failure, cached: this.cached })
  }
  private fail(error: unknown) { this.failure = error; this.publish() }
  private async refresh() {
    this.state = await readLocal(this.key)
    this.publish()
    void this.flush()
  }
  private id() { return doc(collection(this.db, this.groupId ? 'groups' : 'users', this.groupId || this.uid, 'projects')).id }
  private async queue(change: (state: OfflineState) => Mutation) {
    if (!this.isCurrentUser()) throw new Error('permission-denied')
    await updateLocal(this.key, state => ({ ...state, operations: [...state.operations, change(state)] }))
  }
  add(name: string, nextStep: string, rank: number, details: ProjectDetails) {
    validateProject(name, nextStep, details)
    const after = normalizedProject(this.id(), { activityAt:Date.now(),completedAt:details.status==='done'?Date.now():0,...details, name: name.trim(), nextStep: nextStep.trim(), rank, revision: 0 })
    return this.queue(() => ({ id: this.id(), entity: 'project', entityId: after.id, before: null, after }))
  }
  change(project: Project, operation: 'edit' | 'toggle' | 'delete' | 'move', values: ProjectDetails & { name?: string; nextStep?: string; rank?: number } = {}) {
    return this.queue(state => {
      const current = projectedState(state).projects.find(p => p.id === project.id)
      if (!current) throw new Error('project-missing')
      if ((operation === 'edit' || operation === 'delete') && current.revision !== project.revision) throw new Error('conflict')
      let after: Project | null = { ...current, revision: current.revision + 1 }
      if (operation === 'delete') after = null
      else if (operation === 'toggle') after.status = current.status === 'active' ? 'later' : 'active'
      else if (operation === 'move') {
        if (!Number.isFinite(values.rank)) throw new Error('order-limit')
        after.rank = values.rank!
      } else {
        after = normalizedProject(current.id, { ...after, ...values, revision: current.revision + 1, name: values.name?.trim(), nextStep: values.nextStep?.trim() })
        validateProject(after.name, after.nextStep, after)
      }
      if(after)after=completionDates(current,after)
      return { id: this.id(), entity: 'project', entityId: current.id, before: current, after }
    })
  }
  saveSection(name: string, id?: string) {
    if (!name.trim() || name.trim().length > 60) return Promise.reject(new Error('invalid-section'))
    const entityId = id || this.id()
    return this.queue(state => {
      const before = projectedState(state).sections.find(s => s.id === entityId) || null
      const after = { id: entityId, name: name.trim(), revision: before ? (before.revision ?? 0) + 1 : 0 }
      return { id: this.id(), entity: 'section', entityId, before, after }
    })
  }
  async archiveCompleted() {
    if(this.groupId || !this.isCurrentUser())throw new Error('permission-denied')
    const now=Date.now()
    await updateLocal(this.key,state=>{
      const moves:Mutation[]=projectedState(state).projects.filter(project=>shouldArchive(project,true,now)).map(project=>({id:this.id(),entity:'project',entityId:project.id,before:project,after:{...project,archivedAt:now,revision:project.revision+1}}))
      return{...state,operations:[...state.operations,...moves]}
    })
  }
  async deleteSection(id: string) {
    if (!this.isCurrentUser()) throw new Error('permission-denied')
    await updateLocal(this.key, state => {
      const view = projectedState(state)
      const before = view.sections.find(s => s.id === id)
      if (!before) throw new Error('section-missing')
      const moves: Mutation[] = view.projects
        .filter(p => p.sectionId === id)
        .map(project => ({
          id: this.id(), entity: 'project', entityId: project.id,
          before: project,
          after: { ...project, sectionId: '', revision: project.revision + 1 },
        }))
      return { ...state, operations: [...state.operations, ...moves,
        { id: this.id(), entity: 'section', entityId: id,
          before, after: null } as Mutation] }
    })
  }
  private async commit(op: Mutation): Promise<{ remote?: LocalEntity | null }> {
    try {
      return await this.commitAttempt(op)
    } catch (error) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'permission-denied') throw error
      if (!this.isCurrentUser()) throw error
      const ref = doc(this.db, this.groupId ? 'groups' : 'users', this.groupId || this.uid, op.entity === 'project' ? 'projects' : 'sections', op.entityId)
      const snapshot = await getDocFromServer(ref)
      if (!this.isCurrentUser()) throw error
      const data = snapshot.data()
      const remote = data ? (op.entity === 'project' ? normalizedProject(snapshot.id, data) : normalizedSection(snapshot.id, data)) : null
      if (data?.mutationId === op.id) return {}
      if (op.entity==='project'&&remote&&op.before ? !sameProjectBaseline(op.before as Project,remote as Project,data || {}) : JSON.stringify(remote)!==JSON.stringify(op.before)) return { remote }
      throw error
    }
  }
  private async commitAttempt(op: Mutation): Promise<{ remote?: LocalEntity | null }> {
    const ref = doc(this.db, this.groupId ? 'groups' : 'users', this.groupId || this.uid, op.entity === 'project' ? 'projects' : 'sections', op.entityId)
    return runTransaction(this.db, async tx => {
      if (!this.isCurrentUser()) throw new Error('permission-denied')
      const snapshot = await tx.get(ref)
      const data = snapshot.data()
      const remote = data ? (op.entity === 'project' ? normalizedProject(snapshot.id, data) : normalizedSection(snapshot.id, data)) : null
      if (data?.mutationId === op.id || (!remote && !op.after)) return {}
      if ((!op.before && remote) || (op.before && !remote) || (op.before && remote && ((op.before.revision ?? 0) !== (remote.revision ?? 0) || (op.entity === 'section' ? op.before.name !== remote.name : !sameProjectBaseline(op.before as Project,remote as Project,data || {}))))) return { remote }
      if (!op.after) tx.delete(ref)
      else {
        const body: Record<string, unknown> = { ...op.after, updatedAt: serverTimestamp(), mutationId: op.id }
        delete body.id
        const defaults:Record<string,unknown>={links:[],archivedAt:0,trashedAt:0,completedAt:0,resourceType:'project',progressUnits:0,totalUnits:0,followUpDate:'',coverUrl:'',description:'',catalogSource:'',catalogId:''}
        if(data)for(const [key,value] of Object.entries(defaults))if(!(key in data)&&JSON.stringify(body[key])===JSON.stringify(value))delete body[key]
        tx.set(ref, body)
      }
      return {}
    }, { maxAttempts: 3 })
  }
  async flush() {
    if (this.stopped || this.syncing || !navigator.onLine || !this.isCurrentUser() || Date.now() < this.retryAt) return
    this.syncing = true
    this.publish()
    try {
      for (;;) {
        if (this.stopped || !navigator.onLine || !this.isCurrentUser()) break
        const state = await readLocal(this.key)
        const op = nextMutation(state)
        if (!op) break
        const result = await this.commit(op)
        await updateLocal(this.key, current => {
          if (!current.operations.some(item => item.id === op.id)) return current
          if ('remote' in result) return { ...current, operations: current.operations.map(item => item.id === op.id ? { ...item, conflict: { remote: result.remote ?? null } } : item) }
          const remaining = current.operations.filter(item => item.id !== op.id)
          const base = op.entity === 'project' ? current.projects : current.sections
          const existing = base.find(item => item.id === op.entityId)
          let nextBase: LocalEntity[] = base
          if (!op.after) nextBase = base.filter(item => item.id !== op.entityId)
          else if (!existing || (existing.revision ?? 0) <= (op.after.revision ?? 0)) nextBase = [...base.filter(item => item.id !== op.entityId), op.after]
          return { ...current, operations: remaining, ...(op.entity === 'project' ? { projects: nextBase as Project[] } : { sections: nextBase as Section[] }) }
        })
        this.failure = null
      }
    } catch (error) { this.failure = error; this.retryAt = Date.now() + 15000 }
    finally {
      this.syncing = false
      try { this.state = await readLocal(this.key) } catch (error) { this.failure = error }
      this.publish()
    }
  }
  async resolve(opId: string, choice: 'local' | 'remote') {
    await updateLocal(this.key, state => {
      const op = state.operations.find(item => item.id === opId)
      if (!op?.conflict) return state
      const view = projectedState(state)
      const local = (op.entity === 'project' ? view.projects : view.sections).find(item => item.id === op.entityId) || null
      const remote = op.conflict.remote
      const operations = state.operations.filter(item => !(item.entity === op.entity && item.entityId === op.entityId))
      if (choice === 'local' && (local || remote)) operations.push({ id: this.id(), entity: op.entity, entityId: op.entityId, before: remote, after: local ? { ...local, revision: remote ? (remote.revision ?? 0) + 1 : 0 } : null })
      const base = op.entity === 'project' ? state.projects : state.sections
      const existing = base.find(item => item.id === op.entityId)
      const newer = existing && remote && (existing.revision ?? 0) > (remote.revision ?? 0)
      const updated = newer ? base : [...base.filter(item => item.id !== op.entityId), ...(remote ? [remote] : [])]
      return { ...state, operations, ...(op.entity === 'project' ? { projects: updated as Project[] } : { sections: updated as Section[] }) }
    })
    this.retryAt = 0
    this.failure = null
    await this.refresh()
  }
  retry() { this.retryAt = 0; this.failure = null; void this.flush() }
}

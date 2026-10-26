import { shouldArchive } from './workflow'
import type { Project, Section } from '../types'
import type { ProjectDetails } from './projects'
import { ProjectEntity } from './projectEntity'
import type { ProjectOperation, ProjectChanges } from './projectEntity'
import { DomainError } from './appError'
import { emptyState, nextMutation, normalizedProject, normalizedSection, projectedState } from './workspaceModel'
import type { LocalEntity, Mutation, OfflineState } from './workspaceModel'
import type { WorkspaceConnectivity, WorkspaceLock, WorkspaceRemote, WorkspaceStore } from './workspacePorts'

export type OfflineSnapshot = ReturnType<typeof projectedState> & { queued: number; syncing: boolean; conflicts: Mutation[]; error: unknown; cached: boolean }
export class OfflineWorkspace {
  private state: OfflineState = emptyState()
  private stopped = false
  private syncing = false
  private failure: unknown = null
  private cached = true
  private retryAt = 0
  private stops: (() => void)[] = []
  private remoteStops: (() => void)[] = []
  private remoteReady = false
  private watchGeneration = 0
  private readFailures = new Map<string, unknown>()
  readonly key: string
  private readonly local: WorkspaceStore
  private readonly remote: WorkspaceRemote
  private readonly personal: boolean
  private readonly isCurrentUser: () => boolean
  private readonly receive: (snapshot: OfflineSnapshot) => void
  private readonly now: () => number
  private readonly lock: WorkspaceLock
  private readonly connectivity: WorkspaceConnectivity
  constructor(options: {
    key: string; local: WorkspaceStore; remote: WorkspaceRemote; lock: WorkspaceLock; connectivity:WorkspaceConnectivity; personal: boolean
    isCurrentUser: () => boolean; receive: (snapshot: OfflineSnapshot) => void; now?: () => number
  }) {
    this.key = options.key
    this.local = options.local
    this.remote = options.remote
    this.lock = options.lock
    this.connectivity = options.connectivity
    this.personal = options.personal
    this.isCurrentUser = options.isCurrentUser
    this.receive = options.receive
    this.now = options.now || Date.now
  }
  start() {
    this.stops.push(this.local.listen(() => { void this.refresh().catch(error => this.fail(error)) }))
    const resume = () => this.retry()
    this.stops.push(this.connectivity.whenOnline(resume))
    const interval = setInterval(() => { void this.flush() }, 10000)
    this.stops.push(() => clearInterval(interval))
    void this.refresh().then(() => {
      if (this.stopped) return
      this.remoteReady = true
      this.connectRemote()
    }).catch(error => this.fail(error))
    return () => { this.stopped = true; this.watchGeneration++; this.remoteStops.forEach(stop => stop()); this.stops.forEach(stop => stop()) }
  }
  /** Firestore terminates a listener after an error; retry must subscribe again. */
  private connectRemote() {
    if (this.stopped || !this.remoteReady || !this.isCurrentUser()) return
    const generation = ++this.watchGeneration
    this.remoteStops.forEach(stop => stop()); this.remoteStops = []
    const active = () => !this.stopped && generation === this.watchGeneration && this.isCurrentUser()
    const failRead = (target: string, error: unknown) => {
      if (!active()) return
      this.readFailures.set(target, error)
      if (target === 'projects') this.cached = true
      this.publish()
    }
    this.remoteStops.push(this.remote.watchProjects((projects, cached) => {
      if (!active()) return
      this.cached = cached
      if (!cached) {
        this.readFailures.delete('projects')
        void this.update(state => ({ ...state, projects: projects.map(p => normalizedProject(p.id, p)) })).then(() => this.refresh()).catch(error => this.fail(error))
      } else this.publish()
    }, error => failRead('projects', error)))
    this.remoteStops.push(this.remote.watchSections((sections, cached) => {
      if (!active()) return
      if (!cached) {
        this.readFailures.delete('sections')
        void this.update(state => ({ ...state, sections: sections.map(s => normalizedSection(s.id, s)) })).then(() => this.refresh()).catch(error => this.fail(error))
      }
    }, error => failRead('sections', error)))
  }
  private publish() {
    if (!this.stopped) this.receive({ ...projectedState(this.state), queued: this.state.operations.length, syncing: this.syncing, conflicts: this.state.operations.filter(op => op.conflict), error: this.failure || this.readFailures.values().next().value || null, cached: this.cached })
  }
  private fail(error: unknown) { this.failure = error; this.publish() }
  private async refresh() {
    this.state = await this.local.read()
    this.publish()
    void this.flush()
  }
  private id() { return this.remote.newId() }
  private update(change: (state: OfflineState) => OfflineState): Promise<void> {
    return this.local.update(state => {
      if (!this.isCurrentUser()) throw new DomainError('permission-denied')
      return change(state)
    })
  }
  private async queue(change: (state: OfflineState) => Mutation) {
    if (!this.isCurrentUser()) throw new DomainError('permission-denied')
    await this.update(state => ({ ...state, operations: [...state.operations, change(state)] }))
  }
  add(name: string, nextStep: string, rank: number, details: ProjectDetails) {
    const after = ProjectEntity.create(this.id(), name, nextStep, rank, details, this.now()).snapshot()
    return this.queue(() => ({ id: this.id(), entity: 'project', entityId: after.id, before: null, after }))
  }
  change(project: Project, operation: ProjectOperation, values: ProjectChanges = {}) {
    return this.queue(state => {
      const current = projectedState(state).projects.find(item => item.id === project.id)
      if (!current) throw new DomainError('project-missing')
      const after = ProjectEntity.restore(current).apply(operation, values, project.revision, this.now())?.snapshot() ?? null
      return { id: this.id(), entity: 'project', entityId: current.id, before: current, after }
    })
  }
  saveSection(name: string, id?: string) {
    if (!name.trim() || name.trim().length > 60) return Promise.reject(new DomainError('invalid-section'))
    const entityId = id || this.id()
    return this.queue(state => {
      const before = projectedState(state).sections.find(s => s.id === entityId) || null
      const after = { id: entityId, name: name.trim(), revision: before ? (before.revision ?? 0) + 1 : 0 }
      return { id: this.id(), entity: 'section', entityId, before, after }
    })
  }
  async archiveCompleted() {
    if(!this.personal || !this.isCurrentUser())throw new DomainError('permission-denied')
    const now=this.now()
    await this.update(state=>{
      const moves:Mutation[]=projectedState(state).projects.filter(project=>shouldArchive(project,true,now)).map(project=>({id:this.id(),entity:'project',entityId:project.id,before:project,after:{...project,archivedAt:now,revision:project.revision+1}}))
      return{...state,operations:[...state.operations,...moves]}
    })
  }
  async deleteSection(id: string) {
    if (!this.isCurrentUser()) throw new DomainError('permission-denied')
    await this.update(state => {
      const view = projectedState(state)
      const before = view.sections.find(s => s.id === id)
      if (!before) throw new DomainError('section-missing')
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
  async flush() {
    if (this.stopped || this.syncing || !this.connectivity.isOnline() || !this.isCurrentUser() || this.now() < this.retryAt) return
    this.syncing = true
    this.publish()
    try {
      await this.lock.run(this.key, async () => {
      for (;;) {
        if (this.stopped || !this.connectivity.isOnline() || !this.isCurrentUser()) break
        const state = await this.local.read()
        const op = nextMutation(state)
        if (!op) break
        const result = await this.remote.commit(op)
        await this.update( current => {
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
      })
    } catch (error) { this.failure = error; this.retryAt = this.now() + 15000 }
    finally {
      this.syncing = false
      try { this.state = await this.local.read() } catch (error) { this.failure = error }
      this.publish()
    }
  }
  async resolve(opId: string, choice: 'local' | 'remote') {
    await this.update(state => {
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
  retry() { this.retryAt = 0; this.failure = null; if (this.readFailures.size || this.cached) this.connectRemote(); void this.flush() }
}

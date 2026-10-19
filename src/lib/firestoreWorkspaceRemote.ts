import { collection, doc, getDocFromServer, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore'
import type { Firestore } from 'firebase/firestore'
import type { Project, Section } from '../types'
import { DomainError } from './appError'
import { sortedProjects } from './projects'
import { sameProjectBaseline } from './projectBaseline'
import { normalizedProject, normalizedSection } from './workspaceModel'
import type { LocalEntity, Mutation } from './workspaceModel'
import type { WorkspaceRemote } from './workspacePorts'

/** Firestore transport, optimistic concurrency and idempotent replay. */
export class FirestoreWorkspaceRemote implements WorkspaceRemote {
  private readonly db: Firestore
  private readonly uid: string
  private readonly groupId?: string
  private readonly isCurrentUser: () => boolean
  constructor(db: Firestore, uid: string, isCurrentUser: () => boolean, groupId?: string) {
    this.db = db
    this.uid = uid
    this.isCurrentUser = isCurrentUser
    this.groupId = groupId
  }
  private scope() { return [this.groupId ? 'groups' : 'users', this.groupId || this.uid] as const }
  newId() { return doc(collection(this.db, ...this.scope(), 'projects')).id }
  watchProjects(receive: (items: Project[], cached: boolean) => void, fail: (error: Error) => void) {
    return onSnapshot(collection(this.db, ...this.scope(), 'projects'), { includeMetadataChanges: true }, snapshot => {
      receive(sortedProjects(snapshot.docs.map(item => normalizedProject(item.id, item.data()))), snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites)
    }, fail)
  }
  watchSections(receive: (items: Section[], cached: boolean) => void, fail: (error: Error) => void) {
    return onSnapshot(collection(this.db, ...this.scope(), 'sections'), { includeMetadataChanges: true }, snapshot => {
      receive(snapshot.docs.map(item => normalizedSection(item.id, item.data())).sort((a, b) => a.name.localeCompare(b.name)), snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites)
    }, fail)
  }
  async commit(op: Mutation): Promise<{ remote?: LocalEntity | null }> {
    try {
      return await this.commitAttempt(op)
    } catch (error) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'permission-denied') throw error
      if (!this.isCurrentUser()) throw error
      const ref = doc(this.db, ...this.scope(), op.entity === 'project' ? 'projects' : 'sections', op.entityId)
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
    const ref = doc(this.db, ...this.scope(), op.entity === 'project' ? 'projects' : 'sections', op.entityId)
    return runTransaction(this.db, async tx => {
      if (!this.isCurrentUser()) throw new DomainError('permission-denied')
      const snapshot = await tx.get(ref)
      if (!this.isCurrentUser()) throw new DomainError('permission-denied')
      const data = snapshot.data()
      const remote = data ? (op.entity === 'project' ? normalizedProject(snapshot.id, data) : normalizedSection(snapshot.id, data)) : null
      if (data?.mutationId === op.id || (!remote && !op.after)) return {}
      if ((!op.before && remote) || (op.before && !remote) || (op.before && remote && ((op.before.revision ?? 0) !== (remote.revision ?? 0) || (op.entity === 'section' ? op.before.name !== remote.name : !sameProjectBaseline(op.before as Project,remote as Project,data || {}))))) return { remote }
      if (!op.after) tx.delete(ref)
      else {
        const body: Record<string, unknown> = { ...op.after, updatedAt: serverTimestamp(), mutationId: op.id }
        delete body.id
        // Preserve absent legacy fields when their semantic value did not change.
        // Adding normalized defaults can violate a member's allowed changed keys.
        if (data && remote) {
          const baseline: Record<string, unknown> = { ...remote }
          for (const key of Object.keys(body)) {
            if (!(key in data) && JSON.stringify(body[key]) === JSON.stringify(baseline[key])) delete body[key]
          }
        }
        tx.set(ref, body)
      }
      return {}
    }, { maxAttempts: 3 })
  }
}

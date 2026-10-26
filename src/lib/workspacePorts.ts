import type { Project, Section } from '../types'
import type { LocalEntity, Mutation, OfflineState } from './workspaceModel'

export type CommitResult = { remote?: LocalEntity | null }
export interface WorkspaceStore {
  read(): Promise<OfflineState>
  update(change: (state: OfflineState) => OfflineState): Promise<void>
  listen(changed: () => void): () => void
}
export interface WorkspaceRemote {
  newId(): string
  watchProjects(receive: (items: Project[], cached: boolean) => void, fail: (error: Error) => void): () => void
  watchSections(receive: (items: Section[], cached: boolean) => void, fail: (error: Error) => void): () => void
  commit(mutation: Mutation): Promise<CommitResult>
}

/** Serializes one workspace outbox; the browser adapter also coordinates tabs. */
export interface WorkspaceLock { run<T>(key:string,action:()=>Promise<T>):Promise<T> }

export interface WorkspaceConnectivity { isOnline():boolean; whenOnline(resume:()=>void):()=>void }

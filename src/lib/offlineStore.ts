import type { Project, Section } from '../types'

export type LocalEntity = Project | Section
export type Mutation = {
  id: string
  entity: 'project' | 'section'
  entityId: string
  before: LocalEntity | null
  after: LocalEntity | null
  conflict?: { remote: LocalEntity | null }
}
export type OfflineState = { projects: Project[]; sections: Section[]; operations: Mutation[] }
export const emptyState = (): OfflineState => ({ projects: [], sections: [], operations: [] })

export function projectedState(state: OfflineState) {
  const projects = new Map(state.projects.map(p => [p.id, p]))
  const sections = new Map(state.sections.map(s => [s.id, s]))
  for (const op of state.operations) {
    if (op.entity === 'project') {
      if (op.after) projects.set(op.entityId, op.after as Project)
      else projects.delete(op.entityId)
    } else {
      if (op.after) sections.set(op.entityId, op.after as Section)
      else sections.delete(op.entityId)
    }
  }
  return { projects: [...projects.values()].sort((a, b) => a.rank - b.rank || a.id.localeCompare(b.id)), sections: [...sections.values()].sort((a, b) => a.name.localeCompare(b.name)) }
}
export function nextMutation(state: OfflineState) {
  return state.operations.find((op, i) => !op.conflict && !state.operations.slice(0, i).some(previous => previous.entity === op.entity && previous.entityId === op.entityId))
}
export function normalizedProject(id: string, value: Partial<Project>): Project {
  return { archivedAt:value.archivedAt || 0,trashedAt:value.trashedAt || 0,activityAt:value.activityAt || (value as Partial<Project>&{updatedAt?:{toMillis:()=>number}}).updatedAt?.toMillis?.() || 0,completedAt:value.completedAt || 0,resourceType:value.resourceType || 'project',progressUnits:value.progressUnits || 0,totalUnits:value.totalUnits || 0,followUpDate:value.followUpDate || '',coverUrl:value.coverUrl || '',description:value.description || '',catalogSource:value.catalogSource || '',catalogId:value.catalogId || '',id, name: value.name || '', nextStep: value.nextStep || '', projectUrl: value.projectUrl || '', attachmentUrl: value.attachmentUrl || '', links: Array.isArray(value.links)?value.links.filter(link=>typeof link==='string'):[], dueDate: value.dueDate || '', assignedTo: value.assignedTo || '', sectionId: value.sectionId || '', kind: value.kind || 'resume', checkpoint: value.checkpoint || '', checklist: value.checklist || '', status: value.status || 'later', rank: value.rank ?? 0, revision: value.revision ?? 0 }
}
export function normalizedSection(id: string, value: Partial<Section>): Section { return { id, name: value.name || '', revision: value.revision ?? 0 } }

let database: Promise<IDBDatabase> | undefined
function localDatabase() {
  if (!database) database = new Promise((resolve, reject) => {
    const request = indexedDB.open('where-i-left-off-local', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('accounts')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(new Error('local-storage-unavailable'))
    request.onblocked = () => reject(new Error('local-storage-unavailable'))
  })
  return database
}
export async function readLocal(key: string): Promise<OfflineState> {
  const db = await localDatabase()
  return new Promise((resolve, reject) => {
    const request = db.transaction('accounts', 'readonly').objectStore('accounts').get(key)
    request.onsuccess = () => resolve(request.result || emptyState())
    request.onerror = () => reject(new Error('local-storage-unavailable'))
  })
}
let channel: BroadcastChannel | undefined
export function listenLocal(key: string, listener: () => void) {
  if (!channel && typeof BroadcastChannel !== 'undefined') {
    channel = new BroadcastChannel('where-i-left-off-local')
    channel.onmessage = e => window.dispatchEvent(new CustomEvent('recall-local-change', { detail: e.data }))
  }
  const handler = (event: Event) => { if ((event as CustomEvent).detail === key) listener() }
  window.addEventListener('recall-local-change', handler)
  return () => window.removeEventListener('recall-local-change', handler)
}
export async function updateLocal(key: string, change: (state: OfflineState) => OfflineState): Promise<void> {
  const db = await localDatabase()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('accounts', 'readwrite')
    const store = tx.objectStore('accounts')
    const request = store.get(key)
    let failure: unknown
    request.onsuccess = () => {
      try { store.put(change(request.result || emptyState()), key) }
      catch (error) { failure = error; tx.abort() }
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(failure || new Error('local-storage-unavailable'))
    tx.onabort = () => reject(failure || new Error('local-storage-unavailable'))
  })
  window.dispatchEvent(new CustomEvent('recall-local-change', { detail: key }))
  channel?.postMessage(key)
}

export async function clearLocalAccount(projectId: string, uid: string) {
 const db = await localDatabase(), prefix = `${projectId}/${uid}`
 await new Promise<void>((resolve, reject) => {
  const tx = db.transaction('accounts', 'readwrite'), store = tx.objectStore('accounts'), cursor = store.openCursor()
  cursor.onsuccess = () => {
   const item = cursor.result
   if (!item) return
   const key = String(item.key)
   if (key === prefix || key.startsWith(`${prefix}/`)) item.delete()
   item.continue()
  }
  tx.oncomplete = () => resolve(); tx.onerror = () => reject(new Error('local-storage-unavailable'))
 })
}

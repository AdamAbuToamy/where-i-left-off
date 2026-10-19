import { emptyState } from './workspaceModel'
import type { OfflineState } from './workspaceModel'
export { emptyState, nextMutation, normalizedProject, normalizedSection, projectedState } from './workspaceModel'
export type { LocalEntity, Mutation, OfflineState } from './workspaceModel'

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
 try {
  for (const key of [`site-theme:${uid}`,`idle-sleep:${uid}`,`workflow-preferences:${projectId}/${uid}`,`workflow-preferences:${projectId}/${uid}:pending`,`session-journal:${projectId}/${uid}`,`diagnostics/${projectId}/${uid}`,`diagnostics/${projectId}/${uid}/uploaded`]) localStorage.removeItem(key)
 } catch { /* Local storage may be unavailable; IndexedDB cleanup still runs. */ }
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

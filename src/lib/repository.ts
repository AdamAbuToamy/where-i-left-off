import { collection, doc, onSnapshot, runTransaction, serverTimestamp, setDoc } from 'firebase/firestore'
import type { Firestore } from 'firebase/firestore'
import type { Project } from '../types'
import { sortedProjects, validateProject } from './projects'

export function watchProjects(db: Firestore, uid: string, receive: (items: Project[], cached: boolean) => void, fail: (error: Error) => void) {
  return onSnapshot(collection(db, 'users', uid, 'projects'), { includeMetadataChanges: true }, snapshot => {
    receive(sortedProjects(snapshot.docs.map(item => ({ ...item.data(), id: item.id }) as Project)), snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites)
  }, fail)
}

export async function addProject(db: Firestore, uid: string, name: string, nextStep: string, rank: number) {
  validateProject(name, nextStep)
  // Firestore IDs also work on a phone's HTTP LAN preview; no randomUUID dependency.
  const ref = doc(collection(db, 'users', uid, 'projects'))
  await setDoc(ref, { name: name.trim(), nextStep: nextStep.trim(), status: 'later', rank, revision: 0, updatedAt: serverTimestamp() })
}

export async function changeProject(db: Firestore, uid: string, project: Project, operation: 'edit' | 'toggle' | 'delete' | 'move', values: { name?: string; nextStep?: string; rank?: number } = {}) {
  const ref = doc(db, 'users', uid, 'projects', project.id)
  await runTransaction(db, async tx => {
    const snapshot = await tx.get(ref)
    if (!snapshot.exists()) throw new Error('project-missing')
    const current = snapshot.data()
    // Prevent an editor or delete confirmation on one device overwriting a newer revision.
    if ((operation === 'edit' || operation === 'delete') && current.revision !== project.revision) throw new Error('conflict')
    if (operation === 'delete') { tx.delete(ref); return }
    const patch = operation === 'toggle' ? { status: current.status === 'active' ? 'later' : 'active' }
      : operation === 'move' ? { rank: values.rank } : { name: values.name?.trim(), nextStep: values.nextStep?.trim() }
    if (operation === 'edit') validateProject(values.name || '', values.nextStep || '')
    tx.update(ref, { ...patch, revision: current.revision + 1, updatedAt: serverTimestamp() })
  })
}

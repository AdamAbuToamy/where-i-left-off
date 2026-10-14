import { auth } from './firebase'
import { collection, doc, deleteDoc, getDoc, getDocs, onSnapshot, runTransaction, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import type { Firestore } from 'firebase/firestore'
import type { Project, Section } from '../types'
import { sortedProjects, validateProject } from './projects'
import type { ProjectDetails } from './projects'

export function watchProjects(db: Firestore, uid: string, receive: (items: Project[], cached: boolean) => void, fail: (error: Error) => void, groupId?: string) {
  return onSnapshot(collection(db, groupId ? 'groups' : 'users', groupId || uid, 'projects'), { includeMetadataChanges: true }, snapshot => {
    receive(sortedProjects(snapshot.docs.map(item => ({ ...item.data(), id: item.id }) as Project)), snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites)
  }, fail)
}

export async function addProject(db: Firestore, uid: string, name: string, nextStep: string, rank: number, details: ProjectDetails = {}) {
  validateProject(name, nextStep, details)
  // Firestore IDs also work on a phone's HTTP LAN preview; no randomUUID dependency.
  const ref = doc(collection(db, 'users', uid, 'projects'))
  await setDoc(ref, { name: name.trim(), nextStep: nextStep.trim(), projectUrl: details.projectUrl?.trim() || '', attachmentUrl: details.attachmentUrl?.trim() || '', dueDate: details.dueDate || '', sectionId: details.sectionId || '', kind: details.kind || 'resume', checkpoint: details.checkpoint || '', checklist: details.checklist || '', status: details.status || 'later', rank, revision: 0, updatedAt: serverTimestamp() })
}

export async function changeProject(db: Firestore, uid: string, project: Project, operation: 'edit' | 'toggle' | 'delete' | 'move', values: ProjectDetails & { name?: string; nextStep?: string; rank?: number } = {}) {
  const ref = doc(db, 'users', uid, 'projects', project.id)
  await runTransaction(db, async tx => {
    const snapshot = await tx.get(ref)
    if (!snapshot.exists()) throw new Error('project-missing')
    const current = snapshot.data()
    // Prevent an editor or delete confirmation on one device overwriting a newer revision.
    if ((operation === 'edit' || operation === 'delete') && current.revision !== project.revision) throw new Error('conflict')
    if (operation === 'delete') { tx.delete(ref); return }
    const patch = operation === 'toggle' ? { status: current.status === 'active' ? 'later' : 'active' }
      : operation === 'move' ? { rank: values.rank } : { name: values.name?.trim(), nextStep: values.nextStep?.trim(), projectUrl: values.projectUrl?.trim() || '', attachmentUrl: values.attachmentUrl?.trim() || '', dueDate: values.dueDate || '', sectionId: values.sectionId ?? current.sectionId ?? '', kind: values.kind ?? current.kind ?? 'resume', checkpoint: values.checkpoint ?? current.checkpoint ?? '', checklist: values.checklist ?? current.checklist ?? '', status: values.status ?? current.status }
    if (operation === 'edit') validateProject(values.name || '', values.nextStep || '', values)
    tx.update(ref, { ...patch, revision: current.revision + 1, updatedAt: serverTimestamp() })
  })
}

export type UserMetric = { id: string; email: string; suspended: boolean; firstSeen: { toDate: () => Date }; lastSeen: { toDate: () => Date } }

export async function touchUserMetric(db: Firestore, uid: string, email: string) {
  const ref = doc(db, 'appMetrics', uid)
  await runTransaction(db, async tx => {
    const existing = await tx.get(ref)
    tx.set(ref, {
      firstSeen: existing.exists() ? existing.data().firstSeen : serverTimestamp(),
      lastSeen: serverTimestamp(),
      email,
      suspended: existing.exists() ? existing.data().suspended === true : false,
    })
  })
}

export async function readUserMetrics(db: Firestore): Promise<UserMetric[]> {
  const snapshot = await getDocs(collection(db, 'appMetrics'))
  return snapshot.docs.map(item => ({ ...item.data(), id: item.id }) as UserMetric)
}

export function watchUserMetric(db: Firestore, uid: string, receive: (metric: Pick<UserMetric, 'suspended'> | null, cached: boolean) => void, fail: (error: Error) => void) {
  return onSnapshot(doc(db, 'appMetrics', uid), { includeMetadataChanges: true }, snapshot => {
    receive(snapshot.exists() ? { suspended: snapshot.data().suspended === true } : null, snapshot.metadata.fromCache)
  }, fail)
}

export async function setUserSuspended(db: Firestore, uid: string, suspended: boolean) {
  if (suspended && uid === auth?.currentUser?.uid && auth.currentUser.email?.trim().toLowerCase() === 'adam2002hosny@gmail.com') throw new Error('protected-admin')
  const ref = doc(db, 'appMetrics', uid)
  const snapshot = await getDoc(ref)
  if (!snapshot.exists()) throw new Error('account-metric-missing')
  await updateDoc(ref, { suspended })
}

export function watchSections(db: Firestore, uid: string, receive: (sections: Section[], cached: boolean) => void, fail: (error: Error) => void, groupId?: string) {
  return onSnapshot(collection(db, groupId ? 'groups' : 'users', groupId || uid, 'sections'), { includeMetadataChanges: true }, snapshot => receive(snapshot.docs.map(item => ({ id: item.id, name: item.data().name as string, revision: item.data().revision ?? 0 })).sort((a, b) => a.name.localeCompare(b.name)), snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites), fail)
}
export async function saveSection(db: Firestore, uid: string, name: string, id?: string) {
  if (!name.trim() || name.trim().length > 60) throw new Error('invalid-section')
  const ref = id ? doc(db, 'users', uid, 'sections', id) : doc(collection(db, 'users', uid, 'sections'))
  await setDoc(ref, { name: name.trim(), updatedAt: serverTimestamp() })
}
export function deleteSection(db: Firestore, uid: string, id: string) { return deleteDoc(doc(db, 'users', uid, 'sections', id)) }

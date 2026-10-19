import { auth } from './firebase'
import { doc, getDoc, getDocs, collection, onSnapshot, runTransaction, serverTimestamp, updateDoc } from 'firebase/firestore'
import type { Firestore } from 'firebase/firestore'

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

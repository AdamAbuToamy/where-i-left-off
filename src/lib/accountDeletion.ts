import { useEffect, useState } from 'react'
import { doc, onSnapshot, runTransaction, serverTimestamp, Timestamp } from 'firebase/firestore'
import { EmailAuthProvider, GoogleAuthProvider, reauthenticateWithCredential, reauthenticateWithPopup } from 'firebase/auth'
import type { User } from 'firebase/auth'
import { db } from './firebase'
import { logEvent } from './logging'
export const RESTORE_WINDOW_MS = 24 * 60 * 60 * 1000
export type DeletionRequest = { status: 'pending' | 'processing' | 'completed'; requestedAt: Timestamp | null }
export function restoreDeadline(request: DeletionRequest) { return request.requestedAt ? request.requestedAt.toMillis() + RESTORE_WINDOW_MS : null }
function stateKey(uid: string) { return `account-state:v1:${db!.app.options.projectId}/${uid}` }
function readVerifiedState(uid: string): { known: boolean; request: DeletionRequest | null } {
 try {
  const value = JSON.parse(localStorage.getItem(stateKey(uid)) || 'null')
  if (value?.status === 'active') return { known:true, request:null }
  if (['pending','processing','completed'].includes(value?.status) && Number.isFinite(value.requestedAt)) {
   return { known:true, request:{ status:value.status, requestedAt:Timestamp.fromMillis(value.requestedAt) } }
  }
 } catch { /* Unknown state must not be treated as verified absence. */ }
 return { known:false, request:null }
}
function rememberVerifiedState(uid: string, request: DeletionRequest | null) {
 try { localStorage.setItem(stateKey(uid), JSON.stringify(request ? { status:request.status, requestedAt:request.requestedAt?.toMillis() } : { status:'active' })) } catch { /* Offline availability is optional without storage. */ }
}
export function useAccountDeletion(uid: string) {
 const [initial] = useState(() => readVerifiedState(uid))
 const [request, setRequest] = useState<DeletionRequest | null>(initial.request)
 const [loaded, setLoaded] = useState(() => !!initial.request || (!navigator.onLine && initial.known))
 const [cached, setCached] = useState(true)
 useEffect(() => {
  const offline = () => {
   if (navigator.onLine) return
   const verified = readVerifiedState(uid)
   if (verified.known) { setRequest(verified.request); setLoaded(true); setCached(true) }
  }
  window.addEventListener('offline',offline)
  const stop = onSnapshot(doc(db!, 'accountDeletions', uid), { includeMetadataChanges:true }, snapshot => {
   // A missing memory-cache document does not mean the server verified an active account.
   // Keep the last verified pending state, or allow previously verified active accounts offline.
   if (snapshot.metadata.fromCache && !snapshot.exists()) { offline(); return }
   const current = snapshot.exists() ? snapshot.data() as DeletionRequest : null
   setRequest(current);setCached(snapshot.metadata.fromCache);setLoaded(true)
   if (!snapshot.metadata.fromCache) rememberVerifiedState(uid,current)
  }, error => { setLoaded(true); setCached(true); logEvent('account.deletion.watch',error) })
  return () => { stop();window.removeEventListener('offline',offline) }
 },[uid])
 return { request,loaded,cached }
}
export async function confirmIdentity(user: User, password: string) {
 if (user.providerData.some(p => p.providerId === 'google.com')) await reauthenticateWithPopup(user, new GoogleAuthProvider())
 else if (user.email) await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password))
 else throw new Error('unsupported-provider')
 await user.getIdToken(true)
}
export async function requestAccountDeletion(uid: string) {
 if (!navigator.onLine) throw new Error('offline')
 await runTransaction(db!, async tx => {
  const ref = doc(db!, 'accountDeletions', uid)
  const existing = await tx.get(ref)
  if (existing.exists()) throw new Error('already-requested')
  tx.set(ref, { status:'pending', requestedAt:serverTimestamp() })
 })
}
export async function cancelAccountDeletion(uid: string) {
 if (!navigator.onLine) throw new Error('offline')
 await runTransaction(db!, async tx => {
  const ref = doc(db!, 'accountDeletions', uid), snapshot = await tx.get(ref)
  if (!snapshot.exists()) return
  const request = snapshot.data() as DeletionRequest
  const deadline = restoreDeadline(request)
  if (request.status !== 'pending' || !deadline) throw new Error('restore-window-ended')
  // The rules, rather than the device clock, decide whether the 24-hour window is still open.
  tx.delete(ref)
 })
}

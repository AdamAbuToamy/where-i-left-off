import { initializeApp, cert, applicationDefault } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore'
import { deletionDue, DELETION_GRACE_MS } from './deletionPolicy.mjs'

const projectId = process.env.FIREBASE_PROJECT_ID
if (!projectId) throw new Error('FIREBASE_PROJECT_ID is required.')
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT) : null
if (serviceAccount && serviceAccount.project_id !== projectId) throw new Error('Credential project does not match the requested project.')
initializeApp({ projectId, credential:serviceAccount ? cert(serviceAccount) : applicationDefault() })
const db = getFirestore(), auth = getAuth(), execute = process.argv.includes('--execute')
async function deleteMatches(query) {
 while (true) {
  const snapshot = await query.limit(200).get()
  if (snapshot.empty) return
  const batch = db.batch(); snapshot.docs.forEach(item => batch.delete(item.ref)); await batch.commit()
 }
}
async function cleanGroup(gid, uid) {
 const group = db.doc(`groups/${gid}`)
 const emptyOwnedGroup = await db.runTransaction(async tx => {
  const snapshot = await tx.get(group)
  if (!snapshot.exists || snapshot.data().ownerUid !== uid) return false
  const members = await tx.get(group.collection('members'))
  const others = members.docs.filter(member => member.id !== uid).sort((a,b) => (a.data().joinedAt?.toMillis() || 0) - (b.data().joinedAt?.toMillis() || 0) || a.id.localeCompare(b.id))
  if (!others.length) { tx.update(group, { deleted:true }); return true }
  const successor = others[0]
  tx.update(group, { ownerUid:successor.id })
  tx.update(successor.ref, { role:'manager', canCreate:true })
  tx.set(db.doc(`users/${successor.id}/groupMemberships/${gid}`), { groupName:snapshot.data().name, role:'manager' })
  return false
 })
 if (emptyOwnedGroup) {
  await deleteMatches(db.collection('groupInvites').where('groupId','==',gid))
  await db.recursiveDelete(group)
 } else {
  while (true) {
   const cards = await group.collection('projects').where('assignedTo','==',uid).limit(200).get()
   if (cards.empty) break
   const batch = db.batch()
   cards.docs.forEach(card => batch.update(card.ref, { assignedTo:'', revision:FieldValue.increment(1), updatedAt:FieldValue.serverTimestamp() }))
   await batch.commit()
  }
  await group.collection('members').doc(uid).delete()
 }
 await db.doc(`users/${uid}/groupMemberships/${gid}`).delete()
}
async function eraseAccount(uid) {
 let identity = null
 try { identity = await auth.getUser(uid) } catch (error) { if (error.code !== 'auth/user-not-found') throw error }
 // Keep the protected administrator address in sync with src/lib/admin.ts and firestore.rules.
 if (identity?.email?.trim().toLowerCase() === 'adam2002hosny@gmail.com') {
  await db.doc(`accountDeletions/${uid}`).delete(); console.log('Protected administrator request rejected.'); return
 }
 // Delete identity first. Retained request tombstone blocks stale ID tokens in Firestore rules.
 try { await auth.deleteUser(uid) } catch (error) { if (error.code !== 'auth/user-not-found') throw error }
 const [memberships, owned] = await Promise.all([
  db.collection(`users/${uid}/groupMemberships`).get(), db.collection('groups').where('ownerUid','==',uid).get(),
 ])
 const groups = new Set([...memberships.docs.map(d => d.id),...owned.docs.map(d => d.id)])
 for (const gid of groups) await cleanGroup(gid,uid)
 await deleteMatches(db.collection('groupInvites').where('createdBy','==',uid))
 await deleteMatches(db.collection('appLogs').where('uid','==',uid))
 await db.recursiveDelete(db.doc(`users/${uid}`))
 await db.doc(`appMetrics/${uid}`).delete()
 await db.doc(`accountDeletions/${uid}`).update({ status:'completed', completedAt:FieldValue.serverTimestamp(), leaseUntil:FieldValue.delete() })
}
const now = Date.now(), requests = db.collection('accountDeletions')
const [pending,retries] = await Promise.all([
 requests.where('status','==','pending').where('requestedAt','<=',Timestamp.fromMillis(now-DELETION_GRACE_MS)).limit(25).get(),
 requests.where('status','==','processing').limit(25).get(),
])
let failures = 0
for (const request of [...pending.docs,...retries.docs]) {
 if (!deletionDue(request.data(),Date.now())) continue
 if (!execute) { console.log('Eligible deletion found (dry run).'); continue }
 const reserved = await db.runTransaction(async tx => {
  const fresh = await tx.get(request.ref)
  if (!fresh.exists || !deletionDue(fresh.data(),Date.now())) return false
  tx.update(request.ref, { status:'processing', leaseUntil:Timestamp.fromMillis(Date.now()+20*60000) })
  return true
 })
 if (!reserved) continue
 try { await eraseAccount(request.id); console.log('Completed account deletion.') }
 catch (error) {
  failures++
  const code = typeof error.code === 'string' && /^[a-zA-Z0-9/_-]{1,80}$/.test(error.code) ? error.code : 'unknown-error'
  console.error('Deletion failed; it will be retried.',code)
  const log = db.collection('appLogs').doc()
  await log.set({ id:log.id, uid:request.id, timestamp:new Date().toISOString(), level:'error', event:'account.deletion.worker', code, page:'#/settings', environment:'production', version:'worker-v1', durationMs:0, source:'', receivedAt:FieldValue.serverTimestamp() }).catch(() => {})
 }
}
if (failures) { process.exitCode = 1 }
else if (execute) {
 await db.doc('system/accountDeletionWorker').set({ availableUntil:Timestamp.fromMillis(Date.now()+3*3600000), lastRun:FieldValue.serverTimestamp() })
 console.log('Deletion worker ready.')
}

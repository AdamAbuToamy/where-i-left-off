import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, Timestamp, updateDoc } from 'firebase/firestore'
let env: RulesTestEnvironment
const token = (age = 0) => ({ email:'alice@example.test', auth_time: Math.floor(Date.now()/1000)-age })
describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('account deletion security', () => {
 beforeAll(async () => { env = await initializeTestEnvironment({ projectId:'demo-account-security', firestore:{ host:'127.0.0.1', port:8080, rules:readFileSync('firestore.rules','utf8') } }) })
 beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async ctx => { for(const worker of ['accountDeletionWorker','securityEmailWorker'])await setDoc(doc(ctx.firestore(),`system/${worker}`),{ availableUntil:Timestamp.fromMillis(Date.now()+3600000) }) })
 })
 afterAll(async () => { await env?.cleanup() })
 it('requires fresh identity and server time, forbids spoofing, pauses use, and permits timely restoration', async () => {
  const alice = env.authenticatedContext('alice',token()).firestore(), bob = env.authenticatedContext('bob',{ email:'bob@example.test',auth_time:token().auth_time }).firestore()
  const stale = env.authenticatedContext('alice',token(600)).firestore(), ref = doc(alice,'accountDeletions/alice')
  const payload = { status:'pending', requestedAt:serverTimestamp() }
  const admin = env.authenticatedContext('admin',{email:'adam2002hosny@gmail.com',auth_time:token().auth_time}).firestore()
  await assertFails(setDoc(doc(admin,'accountDeletions/admin'),payload))
  await assertFails(setDoc(doc(bob,'accountDeletions/alice'),payload))
  await assertFails(setDoc(doc(stale,'accountDeletions/alice'),payload))
  await assertFails(setDoc(ref,{ status:'pending',requestedAt:Timestamp.fromMillis(Date.now()-86400000) }))
  await assertSucceeds(setDoc(ref,payload))
  await assertFails(getDoc(doc(bob,'accountDeletions/alice')))
  await assertFails(getDoc(doc(alice,'users/alice/projects/project')))
  await assertFails(updateDoc(ref,{ requestedAt:serverTimestamp() }))
  await assertFails(deleteDoc(doc(stale,'accountDeletions/alice')))
  await assertSucceeds(deleteDoc(ref))
  await assertSucceeds(getDoc(doc(alice,'users/alice/projects/project')))
 })
 it('forbids restoration after 24 hours and of processing or completed requests', async () => {
  const alice = env.authenticatedContext('alice',token()).firestore(), ref = doc(alice,'accountDeletions/alice')
  for (const status of ['pending','processing','completed']) {
   await env.withSecurityRulesDisabled(async ctx => { await setDoc(doc(ctx.firestore(),'accountDeletions/alice'),{ status,requestedAt:Timestamp.fromMillis(Date.now()-86401000) }) })
   await assertFails(deleteDoc(ref)); await assertFails(setDoc(ref,{status:'pending',requestedAt:serverTimestamp()}))
  }
 })
 it('queues only fresh verified self notifications and rejects arbitrary recipients or send-state manipulation',async()=>{
  const claims={...token(),email_verified:true}
  const alice=env.authenticatedContext('alice',claims).firestore(),bob=env.authenticatedContext('bob',{...claims,email:'bob@example.test'}).firestore()
  const payload={status:'pending',event:'password-changed',language:'ar',requestedAt:serverTimestamp()},ref=doc(alice,'securityNotifications/alice')
  await assertFails(setDoc(doc(bob,'securityNotifications/alice'),payload))
  await assertFails(setDoc(doc(env.authenticatedContext('alice',{...token(600),email_verified:true}).firestore(),'securityNotifications/alice'),payload))
  await assertFails(setDoc(doc(env.authenticatedContext('alice',{...token(),email_verified:false}).firestore(),'securityNotifications/alice'),payload))
  await assertFails(setDoc(ref,{...payload,to:'other@example.test'}))
  await assertSucceeds(setDoc(ref,payload))
  await assertFails(getDoc(doc(bob,'securityNotifications/alice')))
  await assertFails(updateDoc(ref,{status:'sent'}))
  await assertFails(setDoc(ref,payload))
  await assertFails(deleteDoc(ref))
  await env.withSecurityRulesDisabled(async ctx=>{await setDoc(doc(ctx.firestore(),'securityNotifications/alice'),{...payload,status:'processing',requestedAt:Timestamp.fromMillis(Date.now()-120000)})})
  await assertFails(setDoc(ref,payload))
 })
 it('blocks confirmation requests while the mail worker is unavailable',async()=>{
  await env.withSecurityRulesDisabled(async ctx=>{await deleteDoc(doc(ctx.firestore(),'system/securityEmailWorker'))})
  const alice=env.authenticatedContext('alice',{...token(),email_verified:true}).firestore()
  await assertFails(setDoc(doc(alice,'securityNotifications/alice'),{status:'pending',event:'password-changed',language:'ar',requestedAt:serverTimestamp()}))
 })
 it('does not accept new requests when the worker has no fresh heartbeat',async () => {
  await env.withSecurityRulesDisabled(async ctx => { await deleteDoc(doc(ctx.firestore(),'system/accountDeletionWorker')) })
  const alice = env.authenticatedContext('alice',token()).firestore()
  await assertFails(setDoc(doc(alice,'accountDeletions/alice'),{status:'pending',requestedAt:serverTimestamp()}))
 })
})

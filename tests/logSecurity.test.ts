import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore'
let env: RulesTestEnvironment
const entry = () => ({ id: 'event', uid: 'alice', timestamp: new Date().toISOString(), level: 'error', event: 'project.save', code: 'permission-denied', page: '/personal', environment: 'production', version: 'test', durationMs: 10, source: '', receivedAt: serverTimestamp() })
describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('diagnostics access rules', () => {
  beforeAll(async () => { env = await initializeTestEnvironment({ projectId: 'demo-log-security', firestore: { host: '127.0.0.1', port: 8080, rules: readFileSync('firestore.rules', 'utf8') } }) })
  beforeEach(async () => { await env.clearFirestore() })
  afterAll(async () => { await env?.cleanup() })
  it('isolates records, limits admin to read, forbids spoofed identity and secret payload fields', async () => {
    const alice = env.authenticatedContext('alice', { email: 'alice@example.test' }).firestore()
    const bob = env.authenticatedContext('bob', { email: 'bob@example.test' }).firestore()
    const admin = env.authenticatedContext('admin', { email: 'adam2002hosny@gmail.com', email_verified: true }).firestore()
    const unverified = env.authenticatedContext('admin', { email: 'adam2002hosny@gmail.com', email_verified: false }).firestore()
    const ref = doc(alice, 'appLogs/event'), payload = entry()
    await assertSucceeds(setDoc(ref, payload))
    await assertFails(getDocs(query(collection(alice, 'appLogs'), where('uid', '==', 'alice'))))
    await assertFails(getDocs(collection(alice, 'appLogs')))
    await assertFails(getDoc(doc(bob, 'appLogs/event')))
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'appLogs/event')))
    await assertFails(getDocs(collection(unverified, 'appLogs')))
    await assertSucceeds(getDocs(collection(admin, 'appLogs')))
    await assertFails(setDoc(doc(bob, 'appLogs/event2'), { ...entry(), id: 'event2' }))
    await assertFails(setDoc(doc(alice, 'appLogs/private'), { ...entry(), id: 'private', password: 'bad' }))
    await assertFails(updateDoc(doc(admin, 'appLogs/event'), { code: 'forged', receivedAt: serverTimestamp() }))
    await assertFails(updateDoc(ref, { code: 'forged', receivedAt: serverTimestamp() }))
    await assertSucceeds(setDoc(ref, payload))
    await assertFails(getDoc(ref))
    expect((await getDoc(doc(admin, 'appLogs/event'))).data()?.code).toBe('permission-denied')
  })
})

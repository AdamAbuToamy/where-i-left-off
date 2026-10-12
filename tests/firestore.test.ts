import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { addProject, changeProject, setUserSuspended, touchUserMetric, watchProjects, saveSection } from '../src/lib/repository'
import type { Project } from '../src/types'

const enabled = !!process.env.FIRESTORE_EMULATOR_HOST
let env: RulesTestEnvironment
const data = () => ({ name: 'Robot', nextStep: 'Connect motor', status: 'later', rank: 0, revision: 0, updatedAt: serverTimestamp() })
describe.skipIf(!enabled)('real Firestore emulator: rules and repository', () => {
  beforeAll(async () => { env = await initializeTestEnvironment({ projectId: 'demo-where-i-left-off', firestore: { host: '127.0.0.1', port: 8080, rules: readFileSync('firestore.rules', 'utf8') } }) })
  beforeEach(async () => { await env.clearFirestore() })
  afterAll(async () => { await env?.cleanup() })
  it('owner can create, list, edit, and delete; others and anonymous cannot', async () => {
    const owner = env.authenticatedContext('alice').firestore()
    const ref = doc(owner, 'users/alice/projects/one')
    await assertSucceeds(setDoc(ref, data()))
    await assertSucceeds(getDocs(collection(owner, 'users/alice/projects')))
    await assertSucceeds(updateDoc(ref, { name: 'New name', revision: 1, updatedAt: serverTimestamp() }))
    for (const stranger of [env.authenticatedContext('bob').firestore(), env.unauthenticatedContext().firestore()]) {
      const other = doc(stranger, 'users/alice/projects/one')
      await assertFails(getDoc(other))
      await assertFails(getDocs(collection(stranger, 'users/alice/projects')))
      await assertFails(updateDoc(other, { name: 'Stolen', revision: 2, updatedAt: serverTimestamp() }))
      await assertFails(deleteDoc(other))
      await assertFails(setDoc(doc(stranger, 'users/alice/projects/two'), data()))
    }
    await assertSucceeds(deleteDoc(ref))
  })
  it('rejects malformed documents and forged revision/timestamp', async () => {
    const ref = doc(env.authenticatedContext('alice').firestore(), 'users/alice/projects/one')
    for (const patch of [{ name: '' }, { name: '  ' }, { name: 'x'.repeat(101) }, { nextStep: 'x'.repeat(1001) }, { projectUrl: 'javascript:alert(1)' }, { attachmentUrl: 'file:///etc/passwd' }, { dueDate: '2026-13-01' }, { status: 'admin' }, { kind: 'admin' }, { mutationId: 'x'.repeat(101) }, { sectionId: 'x'.repeat(101) }, { checkpoint: 'x'.repeat(1001) }, { checklist: 'x'.repeat(3001) }, { rank: '0' }, { revision: 5 }, { owner: 'bob' }, { updatedAt: new Date(0) }]) {
      await assertFails(setDoc(ref, { ...data(), ...patch }))
    }
    await setDoc(ref, data())
    await assertFails(updateDoc(ref, { name: 'No revision' }))
  })
  it('restricts admin to aggregate metrics and permits app-access suspension only', async () => {
    const alice = env.authenticatedContext('alice', { email: 'alice@example.test' }).firestore()
    const bob = env.authenticatedContext('bob', { email: 'bob@example.test' }).firestore()
    const admin = env.authenticatedContext('admin', { email: 'adam2002hosny@gmail.com', email_verified: true }).firestore()
    await touchUserMetric(alice, 'alice', 'alice@example.test')
    await touchUserMetric(bob, 'bob', 'bob@example.test')
    await assertSucceeds(getDoc(doc(alice, 'appMetrics/alice')))
    await assertFails(getDocs(collection(alice, 'appMetrics')))
    await assertSucceeds(getDocs(collection(admin, 'appMetrics')))
    await assertFails(getDocs(collection(bob, 'appMetrics')))

    await assertSucceeds(setDoc(doc(alice, 'users/alice/projects/secret'), data()))
    await assertFails(getDoc(doc(admin, 'users/alice/projects/secret')))
    await assertFails(getDocs(collection(admin, 'users/alice/projects')))
    await assertFails(setUserSuspended(alice, 'bob', true))
    await assertFails(setUserSuspended(alice, 'alice', true))
    await assertSucceeds(setUserSuspended(admin, 'alice', true))
    await assertFails(getDoc(doc(alice, 'users/alice/projects/secret')))
    await assertFails(updateDoc(doc(alice, 'users/alice/projects/secret'), { name: 'blocked', revision: 1, updatedAt: serverTimestamp() }))
    await assertSucceeds(getDoc(doc(admin, 'appMetrics/alice')))
    await assertSucceeds(setUserSuspended(admin, 'alice', false))
    await assertSucceeds(getDoc(doc(alice, 'users/alice/projects/secret')))
  })
  it('isolates custom sections and keeps recall fields through reorder and edits', async () => {
    const alice = env.authenticatedContext('alice').firestore()
    await saveSection(alice, 'alice', 'University', 'university')
    await assertSucceeds(getDocs(collection(alice, 'users/alice/sections')))
    for (const outsider of [env.authenticatedContext('bob').firestore(), env.unauthenticatedContext().firestore()]) {
      await assertFails(getDocs(collection(outsider, 'users/alice/sections')))
      await assertFails(saveSection(outsider, 'alice', 'Changed', 'university'))
      await assertFails(deleteDoc(doc(outsider, 'users/alice/sections/university')))
    }
    await expect(saveSection(alice, 'alice', ' ')).rejects.toThrow('invalid-section')
    await assertFails(setDoc(doc(alice, 'users/alice/sections/bad'), { name: 'Section', updatedAt: new Date(0) }))
    await assertFails(setDoc(doc(alice, 'users/alice/sections/bad'), { name: 'Section', revision: 9, updatedAt: serverTimestamp() }))
    await assertSucceeds(setDoc(doc(alice, 'users/alice/sections/versioned'), { name: 'Section', revision: 0, mutationId: 'create', updatedAt: serverTimestamp() }))
    await assertFails(updateDoc(doc(alice, 'users/alice/sections/versioned'), { revision: 7, updatedAt: serverTimestamp() }))
    await assertSucceeds(updateDoc(doc(alice, 'users/alice/sections/versioned'), { name: 'Renamed', revision: 1, mutationId: 'rename', updatedAt: serverTimestamp() }))
    await addProject(alice, 'alice', 'Shopping', '', 0, { kind: 'list', sectionId: 'university', status: 'waiting', checkpoint: 'Waiting for approval', checklist: '[ ] Milk' })
    const ref = (await getDocs(collection(alice, 'users/alice/projects'))).docs[0]
    const project = { ...ref.data(), id: ref.id } as Project
    await changeProject(alice, 'alice', project, 'move', { rank: 100 })
    await changeProject(alice, 'alice', { ...project, revision: 1 }, 'edit', { name: 'Shopping updated', nextStep: 'Go to store' })
    expect((await getDoc(ref.ref)).data()).toMatchObject({ kind: 'list', sectionId: 'university', status: 'waiting', checkpoint: 'Waiting for approval', checklist: '[ ] Milk' })
  })
  it('streams changes to a second session and prevents stale overwrites', async () => {
    const first = env.authenticatedContext('alice').firestore()
    const second = env.authenticatedContext('alice').firestore()
    let items: Project[] = []
    const stop = watchProjects(second, 'alice', list => { items = list }, e => { throw e })
    try {
      await addProject(first, 'alice', 'Phone project', 'Next', 0)
      await expect.poll(() => items.length).toBe(1)
      const old = { ...items[0] }
      await changeProject(first, 'alice', old, 'edit', { name: 'Desktop edit', nextStep: 'Saved' })
      await expect.poll(() => items[0]?.name).toBe('Desktop edit')
      await expect(changeProject(second, 'alice', old, 'edit', { name: 'Stale', nextStep: '' })).rejects.toThrow('conflict')
      await expect(changeProject(second, 'alice', old, 'delete')).rejects.toThrow('conflict')
      await changeProject(second, 'alice', items[0], 'move', { rank: 999 })
      await expect.poll(() => items[0]?.rank).toBe(999)
      await changeProject(first, 'alice', items[0], 'toggle')
      await expect.poll(() => items[0]?.status).toBe('active')
      await changeProject(second, 'alice', items[0], 'delete')
      await expect.poll(() => items.length).toBe(0)
    } finally { stop() }
  })
  it('rejects unverified admin impersonation, metric tampering and self-unsuspension', async () => {
    const alice = env.authenticatedContext('alice', { email: 'alice@example.test' }).firestore()
    const fakeAdmin = env.authenticatedContext('fake', { email: 'adam2002hosny@gmail.com', email_verified: false }).firestore()
    const wrongEmail = env.authenticatedContext('wrong', { email: 'other@example.test', email_verified: true }).firestore()
    const admin = env.authenticatedContext('admin', { email: 'adam2002hosny@gmail.com', email_verified: true }).firestore()
    await touchUserMetric(alice, 'alice', 'alice@example.test')
    for (const db of [fakeAdmin, wrongEmail, env.unauthenticatedContext().firestore()]) {
      await assertFails(getDocs(collection(db, 'appMetrics')))
      await assertFails(setUserSuspended(db, 'alice', true))
    }
    await assertFails(updateDoc(doc(alice, 'appMetrics/alice'), { role: 'admin' }))
    await assertFails(updateDoc(doc(alice, 'appMetrics/alice'), { email: 'adam2002hosny@gmail.com', lastSeen: serverTimestamp() }))
    await setUserSuspended(admin, 'alice', true)
    await assertFails(updateDoc(doc(alice, 'appMetrics/alice'), { suspended: false }))
    await assertFails(deleteDoc(doc(alice, 'appMetrics/alice')))
    await assertFails(setDoc(doc(alice, 'users/alice/projects/blocked'), data()))
    await assertFails(setDoc(doc(alice, 'users/alice/sections/blocked'), { name: 'Blocked', revision: 0, updatedAt: serverTimestamp() }))
    await assertFails(updateDoc(doc(admin, 'appMetrics/alice'), { email: 'changed@example.test' }))
  })
})

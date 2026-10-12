import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { addProject, changeProject, watchProjects } from '../src/lib/repository'
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
    for (const patch of [{ name: '' }, { name: '  ' }, { name: 'x'.repeat(101) }, { nextStep: 'x'.repeat(1001) }, { status: 'admin' }, { rank: '0' }, { revision: 5 }, { owner: 'bob' }, { updatedAt: new Date(0) }]) {
      await assertFails(setDoc(ref, { ...data(), ...patch }))
    }
    await setDoc(ref, data())
    await assertFails(updateDoc(ref, { name: 'No revision' }))
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
})

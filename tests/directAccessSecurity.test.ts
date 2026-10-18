import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { initializeTestEnvironment, assertFails } from '@firebase/rules-unit-testing'
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, collectionGroup, deleteDoc, doc, getDoc, getDocs, setDoc } from 'firebase/firestore'

const projectId = 'demo-direct-access-security'
let env: RulesTestEnvironment
const privatePaths = [
  'users/alice/projects/private', 'users/alice/sections/private',
  'users/alice/preferences/workflow', 'users/alice/sessions/private',
  'users/alice/groupMemberships/private', 'accountDeletions/alice',
  'securityNotifications/alice',
]
describe('direct database access isolation', () => {
  beforeAll(async () => {
    env = await initializeTestEnvironment({ projectId, firestore: { host: '127.0.0.1', port: 8080, rules: readFileSync('firestore.rules', 'utf8') } })
    await env.clearFirestore()
    await env.withSecurityRulesDisabled(async context => {
      for (const path of [...privatePaths, 'groups/private', 'groups/private/projects/private', 'feedback/private']) {
        await setDoc(doc(context.firestore(), path), { uid: 'alice', ownerUid: 'alice', secret: 'private-test-value' })
      }
    })
  })
  afterAll(async () => { await env?.cleanup() })
  for (const actor of ['anonymous', 'bob', 'verified-admin']) {
    it(`${actor} cannot read, list, overwrite or delete another user's private documents`, async () => {
      const db = actor === 'anonymous' ? env.unauthenticatedContext().firestore() : env.authenticatedContext(actor, {
        email: actor === 'verified-admin' ? 'adam2002hosny@gmail.com' : 'bob@example.test', email_verified: true,
      }).firestore()
      for (const path of privatePaths) {
        await assertFails(getDoc(doc(db, path)))
        await assertFails(getDocs(collection(db, path.slice(0, path.lastIndexOf('/')))))
        await assertFails(setDoc(doc(db, path), { secret: 'attacker-overwrite' }))
        await assertFails(deleteDoc(doc(db, path)))
      }
      await assertFails(getDocs(collectionGroup(db, 'projects')))
      await assertFails(getDoc(doc(db, 'unconfigured/private')))
      await assertFails(setDoc(doc(db, 'unconfigured/private'), { admin: true }))
    })
  }
  it('a signed-in outsider cannot inspect a group or private feedback', async () => {
    const db = env.authenticatedContext('bob', { email: 'bob@example.test' }).firestore()
    for (const path of ['groups/private', 'groups/private/projects/private', 'feedback/private']) {
      await assertFails(getDoc(doc(db, path)))
      await assertFails(deleteDoc(doc(db, path)))
    }
  })
  it('raw REST requests without login cannot read, enumerate or overwrite private data', async () => {
    const base = `http://127.0.0.1:8080/v1/projects/${projectId}/databases/(default)/documents`
    for (const path of privatePaths) {
      const read = await fetch(`${base}/${path}`)
      expect(read.status, path).toBe(403)
      expect(await read.text()).not.toContain('private-test-value')
    }
    const list = await fetch(`${base}/users/alice/projects`)
    expect(list.status).toBe(403)
    const write = await fetch(`${base}/users/alice/projects/private`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { secret: { stringValue: 'attacker-overwrite' } } }),
    })
    expect(write.status).toBe(403)
    const query = await fetch(`${base}:runQuery`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'projects', allDescendants: true }] } }),
    })
    expect(query.status).toBe(403)
  })
})

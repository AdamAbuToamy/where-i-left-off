import { FirestoreWorkspaceRemote } from '../src/lib/firestoreWorkspaceRemote'
import { ProjectEntity } from '../src/lib/projectEntity'
import { normalizedProject } from '../src/lib/workspaceModel'
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc, deleteDoc, writeBatch, Timestamp, query, where } from 'firebase/firestore'
import type { User } from 'firebase/auth'
import { createGroup, createInvite, joinGroup, removeMember, revokeInvite, setMemberCreation, deleteGroup } from '../src/lib/groups'

let env: RulesTestEnvironment
const user = (uid: string) => ({ uid, email: `${uid}@example.test`, displayName: uid }) as User
const task = (assignedTo = '') => ({ name: 'Team task', nextStep: 'Draft', status: 'later', assignedTo, checkpoint: '', checklist: '', rank: 0, revision: 0, updatedAt: serverTimestamp() })
describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('group security with real Firestore rules', () => {
  beforeAll(async () => { env = await initializeTestEnvironment({ projectId: 'demo-group-security', firestore: { host: '127.0.0.1', port: 8080, rules: readFileSync('firestore.rules', 'utf8') } }) })
  beforeEach(async () => { await env.clearFirestore() })
  afterAll(async () => { await env?.cleanup() })
  const client = (uid: string) => env.authenticatedContext(uid, { email: `${uid}@example.test` }).firestore()
  async function setup() {
    const owner = client('owner'), member = client('member'), stranger = client('stranger')
    const id = await createGroup(owner, user('owner'), 'University team')
    const group = { id, name: 'University team', role: 'manager' as const }
    const token = await createInvite(owner, user('owner'), group)
    await joinGroup(member, user('member'), token)
    return { owner, member, stranger, id, token, group }
  }
  it('creates manager membership atomically and joins with a valid invite without allowing promotion', async () => {
    const { owner, member, stranger, id, token } = await setup()
    expect((await getDoc(doc(owner, 'groups', id, 'members', 'owner'))).data()?.role).toBe('manager')
    expect((await getDoc(doc(member, 'users/member/groupMemberships', id))).data()?.role).toBe('member')
    await assertSucceeds(getDocs(collection(member, 'groups', id, 'members')))
    await assertFails(getDoc(doc(stranger, 'groups', id)))
    await assertFails(getDocs(collection(stranger, 'groups', id, 'projects')))
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'groupInvites', token)))
    await assertFails(getDocs(collection(stranger, 'groupInvites')))
    await assertSucceeds(getDocs(query(collection(owner, 'groupInvites'), where('groupId', '==', id))))
    await assertFails(updateDoc(doc(member, 'groups', id, 'members', 'member'), { role: 'manager' }))
    await assertFails(setDoc(doc(member, 'users/member/groupMemberships', id), { groupName: 'University team', role: 'manager' }))
    await assertFails(setDoc(doc(stranger, 'users/stranger/groupMemberships', id), { groupName: 'University team', role: 'member' }))
    const batch = writeBatch(stranger)
    batch.set(doc(stranger, 'groups', id, 'members', 'stranger'), { name: 'stranger', email: 'stranger@example.test', role: 'manager', inviteId: token, joinedAt: serverTimestamp() })
    batch.set(doc(stranger, 'users/stranger/groupMemberships', id), { groupName: 'University team', role: 'manager' })
    await assertFails(batch.commit())
    await assertSucceeds(joinGroup(member, user('member'), token))
  })
  it('publishes manager announcements without member replies, spoofing or outsider access', async () => {
    const { owner, member, stranger, id } = await setup()
    const payload={title:'Submission date',body:'Submit tomorrow',authorUid:'owner',authorName:'Manager',createdAt:serverTimestamp()}
    const ref=doc(owner,'groups',id,'announcements','notice')
    await assertSucceeds(setDoc(ref,payload))
    await assertSucceeds(getDocs(collection(member,'groups',id,'announcements')))
    await assertFails(getDocs(collection(stranger,'groups',id,'announcements')))
    await assertFails(setDoc(doc(member,'groups',id,'announcements','reply'),{...payload,authorUid:'member'}))
    await assertFails(setDoc(doc(owner,'groups',id,'announcements','spoof'),{...payload,authorUid:'member'}))
    await assertFails(updateDoc(ref,{body:'Edited after publication'}))
    await assertFails(deleteDoc(doc(member,'groups',id,'announcements','notice')))
    await assertSucceeds(deleteDoc(ref))
  })
  it('allows only your own display name change without changing identity or permissions', async () => {
    const { owner, member, id } = await setup()
    const mine = doc(member, 'groups', id, 'members', 'member')
    await assertSucceeds(updateDoc(mine, { name: 'Adam' }))
    expect((await getDoc(mine)).data()?.name).toBe('Adam')
    await assertFails(updateDoc(mine, { name: '  ' }))
    await assertFails(updateDoc(mine, { name: 'x'.repeat(101) }))
    await assertFails(updateDoc(mine, { name: 'Adam', role: 'manager' }))
    await assertFails(updateDoc(mine, { name: 'Adam', email: 'forged@example.test' }))
    await assertFails(updateDoc(doc(owner, 'groups', id, 'members', 'member'), { name: 'Impersonation' }))
    await assertSucceeds(updateDoc(doc(owner, 'groups', id, 'members', 'owner'), { name: 'Manager name' }))
  })
  it('limits member updates to assigned progress and keeps personal cards private even from managers and admins', async () => {
    const { owner, member, stranger, id } = await setup()
    const ref = doc(owner, 'groups', id, 'projects', 'task')
    await assertSucceeds(setDoc(ref, task('member')))
    const memberRef = doc(member, 'groups', id, 'projects', 'task')
    await assertSucceeds(updateDoc(memberRef, { nextStep: 'Finished draft', status: 'done', checkpoint: 'Reviewed', checklist: '[x] Review', revision: 1, updatedAt: serverTimestamp() }))
    for (const patch of [{ name: 'Stolen' }, { assignedTo: 'owner' }, { rank: 10 }, { projectUrl: 'https://example.test' }, { links: ['https://example.test'] }, { dueDate: '2026-10-20' }, { sectionId: 'bad' }]) await assertFails(updateDoc(memberRef, { ...patch, revision: 2, updatedAt: serverTimestamp() }))
    await assertFails(deleteDoc(memberRef))
    await setMemberCreation(owner, id, 'member', false)
    await assertFails(setDoc(doc(member, 'groups', id, 'projects', 'new'), task('member')))
    await assertFails(updateDoc(doc(stranger, 'groups', id, 'projects', 'task'), { nextStep: 'No', revision: 2, updatedAt: serverTimestamp() }))
    await assertFails(setDoc(doc(owner, 'groups', id, 'projects', 'bad-assignment'), task('stranger')))
    await assertSucceeds(setDoc(doc(owner, 'groups', id, 'projects', 'unassigned'), task()))
    await assertFails(updateDoc(doc(member, 'groups', id, 'projects', 'unassigned'), { nextStep: 'No', revision: 1, updatedAt: serverTimestamp() }))
    await setDoc(doc(member, 'users/member/projects/secret'), task())
    await assertFails(getDoc(doc(owner, 'users/member/projects/secret')))
    const admin = env.authenticatedContext('admin', { email: 'adam2002hosny@gmail.com', email_verified: true }).firestore()
    await assertFails(getDoc(doc(admin, 'groups', id, 'projects', 'task')))
    await assertFails(getDoc(doc(admin, 'users/member/projects/secret')))
    await assertSucceeds(setDoc(doc(owner, 'groups', id, 'sections', 'team'), { name: 'Homework', revision: 0, updatedAt: serverTimestamp() }))
    await assertSucceeds(getDocs(collection(member, 'groups', id, 'sections')))
    await assertFails(setDoc(doc(member, 'groups', id, 'sections', 'new'), { name: 'No', revision: 0, updatedAt: serverTimestamp() }))
  })
  it('saves assigned progress through the application adapter without adding absent legacy fields', async () => {
    const { owner, member, id } = await setup()
    const ref = doc(owner, 'groups', id, 'projects', 'legacy-task')
    await setDoc(ref, task('member'))
    const snapshot = await getDoc(ref)
    const before = normalizedProject(snapshot.id, snapshot.data()!)
    const after = ProjectEntity.restore(before).apply('edit', { nextStep: 'Reviewed', status: 'active' }, before.revision, Date.now())!.snapshot()
    const remote = new FirestoreWorkspaceRemote(member, 'member', () => true, id)
    const mutation = { id: remote.newId(), entity: 'project' as const, entityId: before.id, before, after }
    await assertSucceeds(remote.commit(mutation))
    // An acknowledged mutation replay is idempotent.
    await assertSucceeds(remote.commit(mutation))
    const saved = (await getDoc(ref)).data()!
    expect(saved).toMatchObject({ nextStep: 'Reviewed', revision: 1, assignedTo: 'member' })
    expect(saved).not.toHaveProperty('kind')
    expect(saved).not.toHaveProperty('projectUrl')
    const stale = { ...mutation, id: remote.newId(), after: { ...after, nextStep: 'Stale edit' } }
    expect(await remote.commit(stale)).toHaveProperty('remote')
    expect((await getDoc(ref)).data()?.nextStep).toBe('Reviewed')
  })
  it('accepts fully populated cards through the real adapter and enforces member edit limits', async () => {
    const { owner, member, id } = await setup()
    const managerRemote = new FirestoreWorkspaceRemote(owner, 'owner', () => true, id)
    const before = ProjectEntity.create(managerRemote.newId(), 'Course', 'Lesson 1', 0, {
      assignedTo: 'member', resourceType: 'course', totalUnits: 100, progressUnits: 1,
      links: Array.from({ length: 10 }, (_, i) => `https://example.test/resource/${i}`),
      checkpoint: 'Started', dueDate: '2026-12-01', coverUrl: 'https://example.test/cover.jpg', description: 'Course notes',
      projectUrl: 'https://example.test/course', attachmentUrl: 'https://example.test/notes', followUpDate: '2026-12-02',
      kind: 'list', sectionId: 'study', checklist: '[ ] Lesson', catalogSource: 'catalog', catalogId: 'course-123',
    }, Date.now()).snapshot()
    await assertSucceeds(managerRemote.commit({ id: managerRemote.newId(), entity: 'project', entityId: before.id, before: null, after: before }))
    const memberRemote = new FirestoreWorkspaceRemote(member, 'member', () => true, id)
    const after = ProjectEntity.restore(before).apply('edit', { progressUnits: 2, nextStep: 'Lesson 2' }, 0, Date.now())!.snapshot()
    await assertSucceeds(memberRemote.commit({ id: memberRemote.newId(), entity: 'project', entityId: before.id, before, after }))
    const forbidden = ProjectEntity.restore(after).apply('edit', { name: 'Renamed by member' }, 1, Date.now())!.snapshot()
    await assertFails(memberRemote.commit({ id: memberRemote.newId(), entity: 'project', entityId: before.id, before: after, after: forbidden }))
  })
  it('lets members add self-assigned tasks unless revoked and forbids self-granting permissions', async () => {
    const { owner, member, id } = await setup()
    await assertSucceeds(setDoc(doc(member, 'groups', id, 'projects', 'mine'), task('member')))
    await assertFails(setDoc(doc(member, 'groups', id, 'projects', 'someone-else'), task('owner')))
    await assertFails(setMemberCreation(member, id, 'member', false))
    await assertSucceeds(setMemberCreation(owner, id, 'member', false))
    await assertFails(setDoc(doc(member, 'groups', id, 'projects', 'revoked'), task('member')))
    await assertFails(setMemberCreation(member, id, 'member', true))
    await assertSucceeds(setMemberCreation(owner, id, 'member', true))
    await assertSucceeds(setDoc(doc(member, 'groups', id, 'projects', 'restored'), task('member')))
  })
  it('deletes shared content and memberships while retaining personal cards and supports retry after interruption', async () => {
    const { owner, member, stranger, id } = await setup()
    await setDoc(doc(owner, 'groups', id, 'projects', 'task'), task('member'))
    await setDoc(doc(owner,'groups',id,'announcements','notice'),{title:'Notice',body:'Shared notice',authorUid:'owner',authorName:'Manager',createdAt:serverTimestamp()})
    await setDoc(doc(owner, 'groups', id, 'sections', 'section'), { name: 'Shared', revision: 0, updatedAt: serverTimestamp() })
    await setDoc(doc(member, 'users/member/projects/secret'), task())
    await assertFails(deleteGroup(member, id, 'member'))
    await assertFails(deleteGroup(stranger, id, 'stranger'))
    await assertSucceeds(updateDoc(doc(owner, 'groups', id), { deleted: true }))
    await assertFails(getDocs(collection(member, 'groups', id, 'projects')))
    await assertFails(setDoc(doc(member, 'groups', id, 'projects', 'after-delete'), task('member')))
    await assertSucceeds(deleteGroup(owner, id, 'owner'))
    expect((await getDocs(collection(member, 'users/member/groupMemberships'))).empty).toBe(true)
    expect((await getDoc(doc(member, 'users/member/projects/secret'))).exists()).toBe(true)
    await env.withSecurityRulesDisabled(async context => {
      const db = context.firestore()
      expect((await getDoc(doc(db, 'groups', id))).exists()).toBe(false)
      for (const sub of ['projects', 'sections', 'members', 'announcements']) expect((await getDocs(collection(db, 'groups', id, sub))).empty).toBe(true)
      expect((await getDocs(query(collection(db, 'groupInvites'), where('groupId', '==', id)))).empty).toBe(true)
    })
  })
  it('isolates groups and blocks suspended accounts even with valid memberships', async () => {
    const { owner, member, id } = await setup()
    const otherId = await createGroup(owner, user('owner'), 'Another team')
    await assertFails(getDocs(collection(member, 'groups', otherId, 'members')))
    await assertFails(getDocs(collection(member, 'groups', otherId, 'projects')))
    await env.withSecurityRulesDisabled(async context => { await setDoc(doc(context.firestore(), 'appMetrics/member'), { suspended: true }) })
    await assertFails(getDocs(collection(member, 'groups', id, 'projects')))
    await assertFails(getDocs(collection(member, 'users/member/groupMemberships')))
    await assertFails(createGroup(member, user('member'), 'Blocked team'))
  })
  it('revokes invites, rejects expired tokens and removes access atomically while protecting the owner', async () => {
    const { owner, member, stranger, id, token, group } = await setup()
    await setDoc(doc(owner, 'groups', id, 'projects', 'task'), task('member'))
    await assertFails(removeMember(member, id, 'owner'))
    await assertFails(removeMember(owner, id, 'owner'))
    await assertFails(deleteDoc(doc(owner, 'groups', id, 'members', 'member')))
    await assertSucceeds(removeMember(owner, id, 'member'))
    await assertFails(getDocs(collection(member, 'groups', id, 'projects')))
    await assertFails(updateDoc(doc(member, 'groups', id, 'projects', 'task'), { nextStep: 'Blocked after removal', revision: 1, updatedAt: serverTimestamp() }))
    await assertSucceeds(revokeInvite(owner, token))
    await expect(joinGroup(stranger, user('stranger'), token)).rejects.toThrow()
    const expired = 'ExpiredToken123456789'
    await env.withSecurityRulesDisabled(async context => { await setDoc(doc(context.firestore(), 'groupInvites', expired), { groupId: id, groupName: group.name, createdBy: 'owner', createdAt: Timestamp.fromMillis(0), expiresAt: Timestamp.fromMillis(1) }) })
    await expect(joinGroup(stranger, user('stranger'), expired)).rejects.toThrow()
    const expiredBatch = writeBatch(stranger)
    expiredBatch.set(doc(stranger, 'groups', id, 'members', 'stranger'), { name: 'stranger', email: 'stranger@example.test', role: 'member', inviteId: expired, joinedAt: serverTimestamp() })
    expiredBatch.set(doc(stranger, 'users/stranger/groupMemberships', id), { groupName: group.name, role: 'member' })
    await assertFails(expiredBatch.commit())
    const newToken = await createInvite(owner, user('owner'), group)
    const batch = writeBatch(stranger)
    batch.set(doc(stranger, 'groups', 'another-group', 'members', 'stranger'), { name: 'stranger', email: 'stranger@example.test', role: 'member', inviteId: newToken, joinedAt: serverTimestamp() })
    batch.set(doc(stranger, 'users/stranger/groupMemberships/another-group'), { groupName: group.name, role: 'member' })
    await assertFails(batch.commit())
  })
  it('blocks forged ownership, invite management and malformed member permissions', async () => {
    const { owner, member, stranger, id, token, group } = await setup()
    for (const db of [member, stranger, env.unauthenticatedContext().firestore()]) {
      await assertFails(updateDoc(doc(db, 'groups', id), { ownerUid: 'member' }))
      await assertFails(updateDoc(doc(db, 'groups', id), { deleted: true }))
      await assertFails(deleteDoc(doc(db, 'groups', id)))
      await assertFails(deleteDoc(doc(db, 'groupInvites', token)))
      await assertFails(setDoc(doc(db, 'groups', id, 'sections', 'forged'), { name: 'Forged', revision: 0, updatedAt: serverTimestamp() }))
    }
    await assertFails(createInvite(member, user('member'), group))
    await assertFails(updateDoc(doc(owner, 'groupInvites', token), { expiresAt: Timestamp.fromMillis(Date.now() + 10000) }))
    await assertFails(updateDoc(doc(owner, 'groups', id, 'members', 'member'), { canCreate: 'true' }))
    await assertFails(updateDoc(doc(owner, 'groups', id, 'members', 'member'), { canCreate: true, role: 'manager' }))
    await assertSucceeds(updateDoc(doc(owner, 'groups', id, 'members', 'member'), { canCreate: false }))
    await assertFails(updateDoc(doc(member, 'groups', id, 'members', 'member'), { canCreate: true }))
  })
  it('rejects queued member writes after revocation and prevents joining a deleted group', async () => {
    const { owner, member, stranger, id, token } = await setup()
    const pending = task('member')
    await setMemberCreation(owner, id, 'member', false)
    await assertFails(setDoc(doc(member, 'groups', id, 'projects', 'queued-before-revoke'), pending))
    await updateDoc(doc(owner, 'groups', id), { deleted: true })
    await expect(joinGroup(stranger, user('stranger'), token)).rejects.toThrow()
    await assertFails(setDoc(doc(owner, 'groups', id, 'projects', 'after-tombstone'), task()))
    await assertFails(updateDoc(doc(owner, 'groups', id), { deleted: false }))
  })
})

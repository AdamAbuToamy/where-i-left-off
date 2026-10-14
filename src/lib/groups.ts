import { collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, query, runTransaction, serverTimestamp, Timestamp, updateDoc, where, writeBatch } from 'firebase/firestore'
import type { Firestore } from 'firebase/firestore'
import { displayName } from './profile'
import type { User } from 'firebase/auth'
import type { GroupInfo, GroupMember } from '../types'
export type GroupInvite = { id: string; groupId: string; groupName: string; expiresAt: Timestamp }
export function watchGroups(db: Firestore, uid: string, receive: (groups: GroupInfo[], cached: boolean) => void, fail: (error: Error) => void) {
  return onSnapshot(collection(db, 'users', uid, 'groupMemberships'), { includeMetadataChanges: true }, snap => receive(snap.docs.map(d => ({ id: d.id, name: d.data().groupName, role: d.data().role }) as GroupInfo).sort((a, b) => a.name.localeCompare(b.name)), snap.metadata.fromCache || snap.metadata.hasPendingWrites), fail)
}
export function watchMembers(db: Firestore, groupId: string, receive: (members: GroupMember[], cached: boolean) => void, fail: (error: Error) => void) {
  return onSnapshot(collection(db, 'groups', groupId, 'members'), { includeMetadataChanges: true }, snap => receive(snap.docs.map(d => ({ ...d.data(), uid: d.id, name: d.data().name === d.data().email ? 'Member' : d.data().name }) as GroupMember), snap.metadata.fromCache || snap.metadata.hasPendingWrites), fail)
}
function identity(user: User) { return { name: displayName(user).slice(0, 100), email: user.email || '' } }
export async function createGroup(db: Firestore, user: User, name: string) {
  if (!name.trim() || name.trim().length > 60) throw new Error('invalid-group')
  const ref = doc(collection(db, 'groups')), batch = writeBatch(db)
  batch.set(ref, { name: name.trim(), ownerUid: user.uid, createdAt: serverTimestamp() })
  batch.set(doc(ref, 'members', user.uid), { ...identity(user), role: 'manager', joinedAt: serverTimestamp() })
  batch.set(doc(db, 'users', user.uid, 'groupMemberships', ref.id), { groupName: name.trim(), role: 'manager' })
  await batch.commit()
  return ref.id
}
export async function createInvite(db: Firestore, user: User, group: GroupInfo) {
  const ref = doc(collection(db, 'groupInvites')), expiresAt = Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1000)
  const batch = writeBatch(db)
  batch.set(ref, { groupId: group.id, groupName: group.name, createdBy: user.uid, createdAt: serverTimestamp(), expiresAt })
  await batch.commit()
  return ref.id
}
export function watchInvites(db: Firestore, groupId: string, receive: (items: GroupInvite[]) => void, fail: (error: Error) => void) {
  return onSnapshot(query(collection(db, 'groupInvites'), where('groupId', '==', groupId)), snap => receive(snap.docs.map(d => ({ ...d.data(), id: d.id }) as GroupInvite)), fail)
}
export function revokeInvite(db: Firestore, id: string) { return deleteDoc(doc(db, 'groupInvites', id)) }
export async function previewInvite(db: Firestore, token: string) {
  if (!/^[A-Za-z0-9]{20}$/.test(token)) throw new Error('invalid-invite')
  const snap = await getDoc(doc(db, 'groupInvites', token))
  if (!snap.exists()) throw new Error('invalid-invite')
  return { ...snap.data(), id: snap.id } as GroupInvite
}
export async function joinGroup(db: Firestore, user: User, token: string) {
  if (!/^[A-Za-z0-9]{20}$/.test(token)) throw new Error('invalid-invite')
  return runTransaction(db, async tx => {
    const invitation = await tx.get(doc(db, 'groupInvites', token))
    if (!invitation.exists() || invitation.data().expiresAt.toMillis() <= Date.now()) throw new Error('invalid-invite')
    const { groupId, groupName } = invitation.data()
    const memberRef = doc(db, 'groups', groupId, 'members', user.uid), current = await tx.get(memberRef)
    const role = current.exists() ? current.data().role : 'member'
    if (!current.exists()) tx.set(memberRef, { ...identity(user), role, canCreate: true, inviteId: token, joinedAt: serverTimestamp() })
    tx.set(doc(db, 'users', user.uid, 'groupMemberships', groupId), { groupName, role })
    return groupId as string
  })
}
export async function removeMember(db: Firestore, groupId: string, uid: string) {
  const batch = writeBatch(db)
  batch.delete(doc(db, 'groups', groupId, 'members', uid))
  batch.delete(doc(db, 'users', uid, 'groupMemberships', groupId))
  await batch.commit()
}

export function setMemberCreation(db: Firestore, groupId: string, uid: string, canCreate: boolean) {
  return updateDoc(doc(db, 'groups', groupId, 'members', uid), { canCreate })
}
export async function deleteGroup(db: Firestore, groupId: string, uid: string) {
  const ref = doc(db, 'groups', groupId)
  // Block all member access and writes before cleanup. Retain owner access for safe retry.
  await updateDoc(ref, { deleted: true })
  const [projects, sections, invitations, members, announcements] = await Promise.all([
    getDocs(collection(ref, 'projects')), getDocs(collection(ref, 'sections')),
    getDocs(query(collection(db, 'groupInvites'), where('groupId', '==', groupId))),
    getDocs(collection(ref, 'members')), getDocs(collection(ref, 'announcements')),
  ])
  const refs = [...projects.docs, ...sections.docs, ...invitations.docs, ...announcements.docs].map(d => d.ref)
  for (let i = 0; i < refs.length; i += 200) {
    const batch = writeBatch(db); refs.slice(i, i + 200).forEach(r => batch.delete(r)); await batch.commit()
  }
  // Owner membership stays until the end so interrupted deletion can be retried.
  const others = members.docs.filter(d => d.id !== uid)
  for (let i = 0; i < others.length; i += 100) {
    const batch = writeBatch(db)
    others.slice(i, i + 100).forEach(d => { batch.delete(d.ref); batch.delete(doc(db, 'users', d.id, 'groupMemberships', groupId)) })
    await batch.commit()
  }
  const final = writeBatch(db)
  final.delete(doc(db, 'users', uid, 'groupMemberships', groupId)); final.delete(doc(ref, 'members', uid)); final.delete(ref)
  await final.commit()
}

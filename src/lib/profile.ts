import { updateProfile } from 'firebase/auth'
import type { User } from 'firebase/auth'
import { collection, doc, getDocs, writeBatch } from 'firebase/firestore'
import type { Firestore } from 'firebase/firestore'
export function displayName(user: Pick<User, 'displayName'>) { return user.displayName?.trim() || 'Member' }
export function validName(value: string) { return value.trim().length > 0 && value.trim().length <= 100 }
const syncedNames = new Map<string, string>()
export async function syncMemberNames(db: Firestore, user: User) {
  if (!validName(user.displayName || '')) return
  const cacheKey = `${db.app.options.projectId}/${user.uid}`
  if (syncedNames.get(cacheKey) === displayName(user)) return
  const memberships = await getDocs(collection(db, 'users', user.uid, 'groupMemberships'))
  for (let i = 0; i < memberships.docs.length; i += 200) {
    const batch = writeBatch(db)
    memberships.docs.slice(i, i + 200).forEach(m => batch.update(doc(db, 'groups', m.id, 'members', user.uid), { name: displayName(user) }))
    await batch.commit()
  }
  syncedNames.set(cacheKey, displayName(user))
}
export async function saveName(db: Firestore, user: User, name: string) {
  if (!validName(name)) throw new Error('invalid-name')
  await updateProfile(user, { displayName: name.trim() })
  window.dispatchEvent(new Event('profile-updated'))
  await syncMemberNames(db, user)
}

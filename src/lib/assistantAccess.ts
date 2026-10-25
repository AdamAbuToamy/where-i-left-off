import { isAdmin } from './admin'

/** Production pilot: verified admin ONLY; emulator tests can opt in explicitly.
 * The browser flag is not an authorization control. Firestore/Worker still
 * enforce their own permissions, and no model proposal saves without review.
 */
export function assistantAccess(
  enabled: string | undefined,
  emulatorMode: boolean,
  email: string | null | undefined,
  emailVerified: boolean,
): boolean {
  if (!emailVerified) return false
  if (emulatorMode) return enabled === 'true'
  return isAdmin(email, emailVerified)
}

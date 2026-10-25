import { isAdmin } from './admin'

/** WILO is an optional pilot, never a dependency of core site navigation. */
export function assistantAccess(
  enabled: string | undefined,
  emulatorMode: boolean,
  email: string | null | undefined,
  emailVerified: boolean,
): boolean {
  return enabled === 'true' && emailVerified && (emulatorMode || isAdmin(email, emailVerified))
}

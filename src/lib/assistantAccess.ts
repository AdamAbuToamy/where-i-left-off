/** Assistant visibility for signed-in users (the caller checks authentication).
 * Email verification matches workspace access; roles and record permissions are
 * still checked independently by Firestore and the existing action planner.
 */
export function assistantAccess(
  enabled: string | undefined,
  emulatorMode: boolean,
  _email: string | null | undefined,
  emailVerified: boolean,
): boolean {
  return emailVerified && (emulatorMode ? enabled === 'true' : enabled !== 'false')
}
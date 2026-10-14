// Limited read-only admin access. Keep this value in sync with firestore.rules.
export const ADMIN_EMAIL = 'adam2002hosny@gmail.com'

export function isAdmin(email: string | null | undefined, verified = false) {
  return verified && email?.trim().toLowerCase() === ADMIN_EMAIL
}

export function isProtectedAdminAccount(email: string | null | undefined) {
  return email?.trim().toLowerCase() === ADMIN_EMAIL
}

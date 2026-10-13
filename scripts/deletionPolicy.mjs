export const DELETION_GRACE_MS = 86400000
export function deletionDue(request, now) {
 const requestedAt = request.requestedAt?.toMillis()
 if (!Number.isFinite(requestedAt) || now < requestedAt + DELETION_GRACE_MS) return false
 if (request.status === 'pending') return true
 return request.status === 'processing' && (request.leaseUntil?.toMillis() || 0) <= now
}

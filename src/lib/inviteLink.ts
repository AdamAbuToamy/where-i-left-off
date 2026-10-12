export function inviteToken(input: string, origin: string): string | null {
  try {
    const url = new URL(input.trim())
    const token = url.searchParams.get('groupInvite')
    return url.origin === origin && url.pathname === '/' && /^[A-Za-z0-9]{20}$/.test(token || '') ? token : null
  } catch { return null }
}
export function sharedInvite(search: string, origin: string): string | null {
  const params = new URLSearchParams(search)
  if (params.get('capture') !== 'tab') return null
  const link = params.get('url') || params.get('text')?.match(/https?:\/\/[^\s]+/)?.[0] || ''
  return inviteToken(link, origin)
}

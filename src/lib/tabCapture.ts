export type TabCapture = {
  name: string
  projectUrl: string
}

export function parseTabCapture(search: string): TabCapture | null {
  const params = new URLSearchParams(search)
  if (params.get('capture') !== 'tab') return null

  const rawUrl = (params.get('url') || params.get('text')?.match(/https?:\/\/[^\s]+/)?.[0] || '').trim()
  if (!rawUrl || rawUrl.length > 500) return null

  try {
    const url = new URL(rawUrl)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    const name = (params.get('title') || url.hostname).trim().slice(0, 100) || url.hostname
    return { name, projectUrl: url.toString() }
  } catch {
    return null
  }
}

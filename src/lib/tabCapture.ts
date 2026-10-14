export type TabCapture = {
  name: string
  projectUrl: string
  checkpoint?:string
  resourceType?:'video'|'course'
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
    const rawCheckpoint=params.get('checkpoint') || '',resource=params.get('resource')
    return { name, projectUrl: url.toString(),...(/^\d{2,4}:\d{2}:\d{2} \/ \d{2,4}:\d{2}:\d{2}$/.test(rawCheckpoint)?{checkpoint:rawCheckpoint.slice(0,100),resourceType:resource==='course'?'course' as const:'video' as const}:{}) }
  } catch {
    return null
  }
}

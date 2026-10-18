import { useEffect, useState } from 'react'
export type PageName = 'personal' | 'resume' | 'groups' | 'settings' | 'logs' | 'admin' | 'library' | 'analytics' | 'support'
export function route(hash = location.hash): { page: PageName; groupId: string } {
  const [page, groupId = ''] = hash.split('?')[0].replace(/^#\/?/, '').split('/')
  return { page: ['resume', 'groups', 'settings', 'logs', 'admin', 'library', 'analytics', 'support'].includes(page) ? page as PageName : 'personal', groupId: /^[A-Za-z0-9]{20}$/.test(groupId) && page === 'groups' ? groupId : '' }
}
export function navigate(page: PageName, groupId = '') { location.hash = `/${page}${groupId ? `/${groupId}` : ''}` }
export function usePage() {
  const [current, setCurrent] = useState(() => route())
  useEffect(() => { const changed = () => setCurrent(route()); window.addEventListener('hashchange', changed); return () => window.removeEventListener('hashchange', changed) }, [])
  return current
}

import { useEffect, useState } from 'react'
export type PageName = 'university' | 'notifications' | 'personal' | 'resume' | 'groups' | 'settings' | 'logs' | 'admin' | 'library' | 'analytics' | 'support'
export function route(hash = location.hash): { page: PageName; groupId: string } {
  const [page, groupId = ''] = hash.split('?')[0].replace(/^#\/?/, '').split('/')
  return { page: ['university', 'notifications', 'resume', 'groups', 'settings', 'logs', 'admin', 'library', 'analytics', 'support'].includes(page) ? page as PageName : 'personal', groupId: /^[A-Za-z0-9]{20}$/.test(groupId) && page === 'groups' ? groupId : '' }
}
export function navigate(page: PageName, groupId = '') { location.hash = `/${page}${groupId ? `/${groupId}` : ''}` }
export function usePage() {
  const [current, setCurrent] = useState(() => route())
  useEffect(() => { const changed = () => setCurrent(route()); window.addEventListener('hashchange', changed); return () => window.removeEventListener('hashchange', changed) }, [])
  return current
}

/** Stable deep links used by the site and assistant; no UI selector automation. */
export function workspaceView(hash=location.hash){
 const q=new URLSearchParams(hash.split('?')[1]||'')
 const filter=q.get('filter')||'all'
 return {view:q.get('view')==='week'?'week' as const:'board' as const,search:(q.get('search')||'').slice(0,300),filter:['all','today','waiting','overdue','upcoming','active','later','done','ideas'].includes(filter)?filter:'all',section:q.get('section')||'all',mine:q.get('mine')==='true'}
}
export function studyView(hash=location.hash):{tab:'overview'|'schedule'|'map';courseId:string}{
 const q=new URLSearchParams(hash.split('?')[1]||''),tab=q.get('tab')
 return {tab:tab==='schedule'||tab==='map'?tab:'overview' as const,courseId:q.get('courseId')||''}
}
export function libraryView(hash=location.hash):'archive'|'trash'|'review'|'ideas'{
 const view=new URLSearchParams(hash.split('?')[1]||'').get('view')
 return view==='trash'||view==='review'||view==='ideas'?view:'archive'
}

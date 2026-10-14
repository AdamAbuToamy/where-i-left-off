import type { SessionEntry } from './sessionJournal'
export function mergeSessionCache(remote:SessionEntry[],local:SessionEntry[],fromCache:boolean){
 const ids=new Set(remote.map(s=>s.id))
 return [...remote,...local.filter(s=>(s.pending||fromCache)&&!ids.has(s.id))].sort((a,b)=>b.startedAt-a.startedAt).slice(0,500)
}

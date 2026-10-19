import { currentCard } from './workflow'
import { useEffect, useState } from 'react'
import type { User } from 'firebase/auth'
import type { GroupInfo } from '../types'
import { auth, db } from './firebase'
import { createWorkspace } from './createWorkspace'
import type { OfflineSnapshot } from './offlineWorkspace'
import { watchGroups } from './groups'
import type { TaskEntry } from './taskOverview'
import { logEvent } from './logging'
import { watchUserMetric } from './repository'
export function useTaskOverview(user:User, personalLabel:string, includeAllGroupCards=false,includeGroups=true) {
 const [entries,setEntries]=useState<TaskEntry[]>([]),[allEntries,setAllEntries]=useState<TaskEntry[]>([]),[ready,setReady]=useState(false),[cached,setCached]=useState(true),[suspended,setSuspended]=useState(false)
 useEffect(() => {
  const namespace=`groups/${db!.app.options.projectId}/${user.uid}`
  let groups:GroupInfo[]=[],indexReady=false,alive=true,blocked=false
  try { const raw=localStorage.getItem(namespace);const parsed=JSON.parse(raw || '[]');groups=Array.isArray(parsed)?parsed.filter(g=>typeof g?.id==='string' && typeof g?.name==='string'):[];indexReady=!navigator.onLine && raw!==null } catch { /* Load the server index. */ }
  if(!includeGroups){groups=[];indexReady=true}
  const sources=new Map<string,OfflineSnapshot>(),stops=new Map<string,()=>void>()
  const publish=() => {
   if (!alive) return
   if(blocked){setEntries([]);setAllEntries([]);setReady(false);return}
   const combined=[...sources].flatMap(([id,snapshot]) => (snapshot.error && typeof snapshot.error==='object' && 'code' in snapshot.error && snapshot.error.code==='permission-denied' ? [] : snapshot.projects).filter(project => !id || includeAllGroupCards || project.assignedTo===user.uid).map(project => ({project,scope:id ? groups.find(g=>g.id===id)?.name || '' : personalLabel,groupId:id || undefined,canManage:!id || groups.find(g=>g.id===id)?.role==='manager'})))
   setAllEntries(combined);setEntries(combined.filter(entry=>currentCard(entry.project)))
   setReady(indexReady && sources.has('') && [...stops.keys()].every(id=>sources.has(id)))
   setCached([...sources.values()].some(s=>s.cached || s.queued>0))
  }
  const attach=(id='') => {
   if (stops.has(id)) return
   const workspace=createWorkspace(db!,user.uid,()=>alive && auth?.currentUser?.uid === user.uid, snapshot=>{sources.set(id,snapshot);publish()},id || undefined)
   stops.set(id,workspace.start())
  }
  const stopMetric=watchUserMetric(db!,user.uid,metric=>{blocked=metric?.suspended===true;setSuspended(blocked);publish()},error=>logEvent('resume.access',error))
  attach();groups.forEach(group=>attach(group.id))
  const stopIndex=includeGroups?watchGroups(db!,user.uid,(items,fromCache)=>{
   if (fromCache) return
   groups=items;indexReady=true
   try {localStorage.setItem(namespace,JSON.stringify(items))} catch { /* Optional cache. */ }
   for (const [id,stop] of stops) if (id && !items.some(g=>g.id===id)) {stop();stops.delete(id);sources.delete(id)}
   items.forEach(group=>attach(group.id));publish()
  }, error=>{indexReady=true;logEvent('resume.groups',error);publish()}):()=>{}
  return ()=>{alive=false;stopMetric();stopIndex();stops.forEach(stop=>stop())}
 },[user.uid,personalLabel,includeAllGroupCards,includeGroups])
 return {entries,allEntries,ready,cached,suspended}
}

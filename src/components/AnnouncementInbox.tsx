import LinkedText from './LinkedText'
import { useEffect,useState } from 'react'
import type { User } from 'firebase/auth'
import type { Language } from '../translations'
import { featureText } from '../featureText'
import { db } from '../lib/firebase'
import { watchGroups } from '../lib/groups'
import { watchAnnouncements,lastRead,acknowledgeAnnouncements } from '../lib/announcements'
import type { Announcement } from '../lib/announcements'
import { logEvent } from '../lib/logging'
type Entry=Announcement & {groupId:string;groupName:string}
export default function AnnouncementInbox({user,language}:{user:User;language:Language}) {
 const [items,setItems]=useState<Entry[]>([]),[,refresh]=useState(0),t=featureText[language]
 useEffect(()=>{const read=()=>refresh(n=>n+1);window.addEventListener('announcements-read',read);return()=>window.removeEventListener('announcements-read',read)},[])
 useEffect(()=>{
  const feeds=new Map<string,Entry[]>(),stops=new Map<string,()=>void>()
  const publish=()=>setItems([...feeds.values()].flat().sort((a,b)=>(b.createdAt?.toMillis() || 0)-(a.createdAt?.toMillis() || 0)))
  const stopIndex=watchGroups(db!,user.uid,(groups,cached)=>{
   if(cached)return
   for(const [id,stop]of stops)if(!groups.some(g=>g.id===id)){stop();stops.delete(id);feeds.delete(id)}
   groups.forEach(group=>{if(!stops.has(group.id))stops.set(group.id,watchAnnouncements(group.id,announcements=>{feeds.set(group.id,announcements.map(item=>({...item,groupId:group.id,groupName:group.name})));publish()},error=>{feeds.delete(group.id);publish();logEvent('announcements.inbox',error)},5))});publish()
  },error=>logEvent('announcements.groups',error))
  return()=>{stopIndex();stops.forEach(stop=>stop())}
 },[user.uid])
 const unread=items.filter(item=>item.createdAt && item.createdAt.toMillis()>lastRead(user.uid,item.groupId))
 if(!unread.length)return null
 return <details className="announcement-inbox"><summary>● {t.newAnnouncements} ({unread.length})</summary>{unread.slice(0,5).map(item=><article key={`${item.groupId}/${item.id}`}><strong dir="auto">{item.groupName}: <LinkedText text={item.title}/></strong><p dir="auto"><LinkedText text={item.body}/></p><a href={`#/groups/${item.groupId}`}>{t.announcements} ↗</a><button className="secondary-button" onClick={()=>acknowledgeAnnouncements(user.uid,item.groupId,item.createdAt?.toMillis() || 0)}>{t.acknowledge}</button></article>)}</details>
}

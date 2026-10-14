import LinkedText from './LinkedText'
import { useEffect,useState } from 'react'
import type { User } from 'firebase/auth'
import type { GroupInfo } from '../types'
import type { Language } from '../translations'
import { featureText } from '../featureText'
import { publishAnnouncement,removeAnnouncement,watchAnnouncements,acknowledgeAnnouncements,lastRead } from '../lib/announcements'
import type { Announcement } from '../lib/announcements'
import { logEvent } from '../lib/logging'
export default function GroupAnnouncements({group,user,language}:{group:GroupInfo;user:User;language:Language}) {
 const t=featureText[language],[items,setItems]=useState<Announcement[]>([]),[title,setTitle]=useState(''),[body,setBody]=useState(''),[busy,setBusy]=useState(false),[failed,setFailed]=useState(false),[,refresh]=useState(0)
 useEffect(()=>{const read=()=>refresh(n=>n+1);window.addEventListener('announcements-read',read);return()=>window.removeEventListener('announcements-read',read)},[])
 useEffect(()=>watchAnnouncements(group.id,setItems,error=>{setFailed(true);logEvent('announcements.list',error)}),[group.id])
 async function run(action:()=>Promise<unknown>){if(busy)return;setBusy(true);setFailed(false);try{await action()}catch(error){setFailed(true);logEvent('announcements.write',error)}finally{setBusy(false)}}
 return <details className="group-announcements"><summary>{t.announcements} ({items.length})</summary><p>{t.announceHint}</p>{group.role==='manager' && <form onSubmit={e=>{e.preventDefault();void run(async()=>{await publishAnnouncement(group.id,user,title,body);setTitle('');setBody('')})}}><label htmlFor="announcement-title">{t.announceTitle}</label><input id="announcement-title" maxLength={100} required value={title} onChange={e=>setTitle(e.target.value)} disabled={busy}/><label htmlFor="announcement-body">{t.announceBody}</label><textarea id="announcement-body" maxLength={2000} rows={3} required value={body} onChange={e=>setBody(e.target.value)} disabled={busy}/><button className="primary-button" disabled={busy || !title.trim() || !body.trim()}>{t.publish}</button></form>}{failed&&<p role="alert">{t.announcementFail}</p>}{!items.length&&<p>{t.noAnnouncements}</p>}{items.map(item=><article className="announcement" key={item.id}><h3 dir="auto"><LinkedText text={item.title}/></h3><p className="announcement-body" dir="auto"><LinkedText text={item.body}/></p><small>{item.authorName || t.manager} · {item.createdAt?.toDate().toLocaleString(language) || '…'}</small><div>{!!item.createdAt && item.createdAt.toMillis()>lastRead(user.uid,group.id) && <button className="secondary-button" onClick={()=>acknowledgeAnnouncements(user.uid,group.id,item.createdAt?.toMillis() || 0)}>{t.acknowledge}</button>}{group.role==='manager'&&<button className="text-button" disabled={busy} onClick={()=>void run(()=>removeAnnouncement(group.id,item.id))}>{t.remove}</button>}</div></article>)}</details>
}

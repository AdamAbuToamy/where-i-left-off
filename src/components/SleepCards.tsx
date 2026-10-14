import { useEffect,useState } from 'react'
import type { User } from 'firebase/auth'
import type { Language } from '../translations'
import { featureText } from '../featureText'
import { useTaskOverview } from '../lib/useTaskOverview'
import { sortTasks,checklistItems } from '../lib/taskOverview'
import type { TaskEntry } from '../lib/taskOverview'
export function SleepCardDeck({entries,language}:{entries:TaskEntry[];language:Language}){
 const [offset,setOffset]=useState(0),t=featureText[language]
 const pending=sortTasks(entries).filter(entry=>entry.project.status!=='done'),cards=pending.length?pending:sortTasks(entries)
 useEffect(()=>{
  if(cards.length<=1 || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return
  const timer=window.setInterval(()=>setOffset(n=>n+1),8000)
  return()=>window.clearInterval(timer)
 },[cards.length])
 const visible=cards.length?Array.from({length:Math.min(3,cards.length)},(_,i)=>cards[(offset+i)%cards.length]):[]
 return <div className="sleep-real-cards">{visible.map(entry=>{
  const p=entry.project,items=checklistItems(p.checklist)
  return <article className="sleep-real-card" key={`${entry.groupId || 'personal'}/${p.id}`}><div className="sleep-real-meta"><span>{entry.scope}</span>{p.dueDate&&<time dateTime={p.dueDate}>{p.dueDate}</time>}</div><h3 dir="auto">{p.name}</h3>{p.checkpoint&&<p className="sleep-checkpoint" dir="auto">{p.checkpoint}</p>}<p className="sleep-next" dir="auto"><strong>{t.next}</strong><span>{p.nextStep || '—'}</span></p>{!!items.length&&<small>✓ {items.filter(item=>item.done).length} / {items.length}</small>}</article>
 })}</div>
}
export default function SleepCards({user,language}:{user:User;language:Language}){
 const t=featureText[language],{entries,ready,suspended}=useTaskOverview(user,t.personal,true)
 if(suspended)return null
 if(!ready&&!entries.length)return <p role="status">…</p>
 if(!entries.length)return <p>{t.empty}</p>
 return <SleepCardDeck entries={entries} language={language}/>
}

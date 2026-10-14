import { useState } from 'react'
import type { User } from 'firebase/auth'
import type { Language } from '../translations'
import { workflowText } from '../workflowText'
import { useTaskOverview } from '../lib/useTaskOverview'
import { useWorkflowPreferences } from '../lib/workflowPreferences'
import { currentCard,needsReview,DAY_MS } from '../lib/workflow'
import { taskLink } from '../lib/taskOverview'
import type { TaskEntry } from '../lib/taskOverview'
import { mutateTask } from '../lib/taskMutation'
import { localDateKey } from '../lib/projects'
import LinkedText from './LinkedText'
import { logEvent } from '../lib/logging'
import { translations } from '../translations'
export default function LibraryPage({user,language}:{user:User;language:Language}){
 const t=workflowText[language],{allEntries,ready,suspended,cached}=useTaskOverview(user,language==='ar'?'مشاريعي':language==='he'?'הפרויקטים שלי':'My projects',true),prefs=useWorkflowPreferences(user.uid)
 const [view,setView]=useState<'archive'|'trash'|'review'|'ideas'>('archive'),[busy,setBusy]=useState(false),[failed,setFailed]=useState(false)
 const match=(entry:TaskEntry)=>{const p=entry.project;return view==='trash'?!!p.trashedAt:view==='archive'?!!p.archivedAt&&!p.trashedAt:view==='ideas'?currentCard(p)&&p.resourceType==='idea':needsReview(p,prefs.reviewDays)}
 const rows=allEntries.filter(match)
 async function run(action:()=>Promise<void>){if(busy)return;setBusy(true);setFailed(false);try{await action()}catch(error){setFailed(true);logEvent('library.action',error)}finally{setBusy(false)}}
 if(suspended)return <p role="alert">{translations[language].accountSuspended}</p>
 return <section className="library-page"><h2>{t.library}</h2><nav className="workflow-tabs" aria-label={t.library}>{(['archive','trash','review','ideas'] as const).map(kind=><button className="secondary-button" key={kind} aria-pressed={view===kind} onClick={()=>setView(kind)}>{t[kind]}</button>)}</nav><p>{view==='archive'?t.archiveHint:view==='trash'?t.trashHint:view==='review'?t.reviewHint:''}</p>{cached&&<small>{t.cached}</small>}{!ready&&<p role="status">…</p>}{failed&&<p role="alert">{t.fail}</p>}{ready&&!rows.length&&<p className="empty-state">{t.empty}</p>}<div className="resume-grid">{rows.map(entry=>{const p=entry.project;return <article className="resume-card" key={`${entry.groupId}/${p.id}`}><small>{entry.scope}</small><h3><LinkedText text={p.name}/></h3><p><LinkedText text={p.checkpoint || p.nextStep}/></p>{view!=='trash'&&view!=='archive'&&<a className="secondary-button" href={taskLink(entry)}>{t.continue}</a>}{entry.canManage&&<div className="library-actions">{(view==='archive'||view==='trash')&&<button className="primary-button" disabled={busy} onClick={()=>void run(()=>mutateTask(user,entry,{archivedAt:0,trashedAt:0,completedAt:p.status==='done'?Date.now():0}))}>{t.restore}</button>}{(view==='review'||view==='ideas')&&<><button className="secondary-button" disabled={busy} onClick={()=>void run(()=>mutateTask(user,entry,{resourceType:p.resourceType==='idea'?'project':p.resourceType,status:'active',activityAt:Date.now(),followUpDate:localDateKey(new Date(Date.now()+7*DAY_MS))}))}>{t.continue}</button><button className="secondary-button" disabled={busy} onClick={()=>void run(()=>mutateTask(user,entry,{followUpDate:localDateKey(new Date(Date.now()+7*DAY_MS)),activityAt:Date.now()}))}>{t.later}</button><button className="secondary-button" disabled={busy} onClick={()=>void run(()=>mutateTask(user,entry,{archivedAt:Date.now()}))}>{t.archiveCard}</button></>}{view!=='trash'&&<button className="text-button" disabled={busy} onClick={()=>void run(()=>mutateTask(user,entry,{trashedAt:Date.now()}))}>{t.trashCard}</button>}{view==='trash'&&<button className="danger-button" disabled={busy} onClick={()=>{if(window.confirm(t.permanentAsk))void run(()=>mutateTask(user,entry,{},true))}}>{t.permanent}</button>}</div>}</article>})}</div></section>
}

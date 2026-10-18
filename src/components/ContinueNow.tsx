import { workflowText } from '../workflowText'
import { recommendation } from '../lib/workflow'
import { useWorkflowPreferences } from '../lib/workflowPreferences'
import LinkedText from './LinkedText'
import type { User } from 'firebase/auth'
import type { Language } from '../translations'
import { translations } from '../translations'
import { featureText } from '../featureText'
import { useTaskOverview } from '../lib/useTaskOverview'
import { sortTasks,taskLink,checklistItems } from '../lib/taskOverview'
import { localDateKey } from '../lib/projects'
import SummaryPdfButton from './SummaryPdfButton'
export default function ContinueNow({user,language}:{user:User;language:Language}) {
 const t=featureText[language],{entries,ready,cached,suspended}=useTaskOverview(user,t.personal)
 const w=workflowText[language],prefs=useWorkflowPreferences(user.uid)
 const sorted=sortTasks(entries),today=localDateKey()
 const candidates=sorted.filter(e=>e.project.status!=='done' && e.project.status!=='waiting'&&e.project.resourceType!=='idea')
 const focus=prefs.reminders?sorted.filter(e=>recommendation(e)!==null):candidates.filter(e=>e.project.status==='active')
 const waiting=sorted.filter(e=>e.project.status==='waiting')
 const rows=(focus.length ? focus : candidates).slice(0,3)
 const render=(items:typeof entries)=>items.map(entry=>{
  const p=entry.project,list=checklistItems(p.checklist),done=list.filter(item=>item.done).length
  return <article className="resume-card" key={`${entry.groupId || 'personal'}/${p.id}`}><div className="resume-meta"><span>{entry.scope}</span>{p.dueDate && <time className={p.dueDate<today ? 'is-overdue' : ''} dateTime={p.dueDate}>{p.dueDate<today ? `${t.overdue} · ` : ''}{p.dueDate}</time>}</div>{recommendation(entry)&&<small className="recommendation-reason">{w.reasons[recommendation(entry)!]}</small>}<h2 dir="auto"><LinkedText text={p.name}/></h2>{p.checkpoint && <p dir="auto"><strong>{t.checkpoint}: </strong><LinkedText text={p.checkpoint}/></p>}<p className="resume-next" dir="auto"><strong>{t.next}: </strong><LinkedText text={p.nextStep || '—'}/></p>{!!list.length && <span className="resume-progress">✓ {done} / {list.length}</span>}<a className="primary-button" href={taskLink(entry)}>{t.open} ↗</a></article>
 })
 if(suspended)return <section className="empty-state" role="alert">{translations[language].accountSuspended}</section>
 return <section className="resume-page"><div className="resume-header"><div><h2>{t.resume}</h2><p>{t.intro}</p></div><div className="resume-tools"><nav className="review-actions" aria-label={w.weekly}><a href="#/library?view=review">{w.review}<span aria-hidden="true">↗</span></a><a href="#/analytics">{w.weekly}<span aria-hidden="true">↗</span></a></nav><section className="workspace-report resume-report"><div><h3>{t.report}</h3><p>{t.personal} · {t.total}: {entries.length}</p></div><SummaryPdfButton entries={entries} language={language} title={t.report} userName={user.displayName || ''} cached={cached} disabled={!ready} /></section></div></div>{!ready && <p role="status">…</p>}{ready && !rows.length && !waiting.length && <p className="empty-state">{t.empty}</p>}{!focus.length && !!rows.length && <h3>{t.later}</h3>}<div className="resume-grid">{render(rows)}</div>{!!waiting.length && <details className="resume-waiting"><summary>{t.waiting} ({waiting.length})</summary><div className="resume-grid">{render(waiting)}</div></details>}</section>
}

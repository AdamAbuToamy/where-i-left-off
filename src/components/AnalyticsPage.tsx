import type { User } from 'firebase/auth'
import type { Language } from '../translations'
import { workflowText } from '../workflowText'
import { useSessionHistory } from '../lib/sessionJournal'
import { useTaskOverview } from '../lib/useTaskOverview'
import { progressStats } from '../lib/analytics'
import { translations } from '../translations'
export default function AnalyticsPage({user,language}:{user:User;language:Language}){
 const t=workflowText[language],{items}=useSessionHistory(user.uid),{allEntries,suspended}=useTaskOverview(user,'Personal')
 if(suspended)return <p role="alert">{translations[language].accountSuspended}</p>
 const stats=progressStats(items,allEntries)
 const rows=[[`${(stats.monthSeconds/3600).toFixed(1)} ${t.hours}`,t.month],[String(stats.monthSessions),t.sessions],[String(stats.completed),t.completed],[String(stats.books),t.books]]
 return <section className="analytics-page"><h2>{t.analytics}</h2><p>{t.month} · {t.recent}</p><div className="analytics-grid">{rows.map(([value,label])=><article className="analytics-stat" key={label}><strong>{value}</strong><span>{label}</span></article>)}</div><section className="weekly-summary"><h3>{t.weekly}</h3><p>{stats.weekSessions} {t.sessions} · {Math.floor(stats.weekSeconds/60)} {t.minutes}</p><a className="primary-button" href="#/resume">{t.focus}</a></section><h3>{t.history}</h3>{!items.length&&<p>{t.noSessions}</p>}{items.slice(0,20).map(s=><article className="session-history" key={s.id}><strong dir="auto">{s.projectName}</strong><time>{new Date(s.endedAt).toLocaleString(language)}</time><p dir="auto">{s.checkpoint}</p><small>{Math.floor(s.seconds/60)} {t.minutes}{s.pending?' · …':''}</small></article>)}</section>
}

import type { SessionEntry } from './sessionJournal'
import type { TaskEntry } from './taskOverview'
export function progressStats(sessions:SessionEntry[],entries:TaskEntry[],now=Date.now()){
 const date=new Date(now),monthStart=new Date(date.getFullYear(),date.getMonth(),1).getTime(),weekStart=new Date(date.getFullYear(),date.getMonth(),date.getDate()).getTime()-((date.getDay()+6)%7)*86400000
 const visible=entries.filter(entry=>!entry.project.trashedAt)
 const month=sessions.filter(s=>s.startedAt>=monthStart&&s.startedAt<=now),week=sessions.filter(s=>s.startedAt>=weekStart&&s.startedAt<=now)
 const completed=visible.filter(entry=>entry.project.status==='done'&&(entry.project.completedAt || 0)>=monthStart&&(entry.project.completedAt || 0)<=now)
 const yearStart=new Date(date.getFullYear(),0,1).getTime(),yearBooks=visible.filter(entry=>entry.project.status==='done'&&entry.project.resourceType==='book'&&(entry.project.completedAt || 0)>=yearStart&&(entry.project.completedAt || 0)<=now).length
 return{yearBooks,monthSeconds:month.reduce((sum,s)=>sum+s.seconds,0),weekSeconds:week.reduce((sum,s)=>sum+s.seconds,0),monthSessions:month.length,weekSessions:week.length,completed:completed.length,books:completed.filter(e=>e.project.resourceType==='book').length,learningSeconds:month.filter(s=>['book','course','video'].includes(s.resourceType)).reduce((sum,s)=>sum+s.seconds,0)}
}

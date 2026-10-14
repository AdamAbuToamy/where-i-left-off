import { normalizedProject } from './offlineStore'
import type { Project } from '../types'
import type { TaskEntry } from './taskOverview'
import { localDateKey } from './projects'
export const DAY_MS=86400000
export const resourceTypes=['project','book','course','video','series','film','shopping','idea'] as const
export function currentCard(p:Project){return !p.archivedAt&&!p.trashedAt}
export function lastActivity(p:Project){return p.activityAt || 0}
export function needsReview(p:Project,days=30,now=Date.now()){return currentCard(p)&&p.status!=='done'&&p.resourceType!=='idea'&&!!lastActivity(p)&&now-lastActivity(p)>=days*DAY_MS}
export function shouldArchive(p:Project,enabled:boolean,now=Date.now()){return enabled&&currentCard(p)&&p.status==='done'&&!!(p.completedAt || p.activityAt)&&now-(p.completedAt || p.activityAt || now)>=7*DAY_MS}
export function recommendation(entry:TaskEntry,now=Date.now()):'active'|'due'|'waiting'|'stale'|null{
 const p=entry.project,today=localDateKey(new Date(now))
 if(!currentCard(p)||p.status==='done'||p.resourceType==='idea')return null
 if(p.status==='waiting')return p.followUpDate&&p.followUpDate<=today?'waiting':null
 if(p.dueDate&&p.dueDate<=localDateKey(new Date(now+DAY_MS)))return 'due'
 if(p.status==='active')return 'active'
 if(['book','course','video','series'].includes(p.resourceType || '')&&lastActivity(p)&&now-lastActivity(p)>=7*DAY_MS)return 'stale'
 return null
}
export function completionDates(before:Project,after:Project,now=Date.now()):Project{
 const fields=['name','nextStep','checkpoint','checklist','status','progressUnits','projectUrl','attachmentUrl','links','dueDate','followUpDate','resourceType','totalUnits','description','coverUrl'] as const
 const baseline=normalizedProject(before.id,before),resulting=normalizedProject(after.id,after)
 const changed=fields.some(key=>JSON.stringify(baseline[key])!==JSON.stringify(resulting[key]))
 return {...after,activityAt:changed?now:after.activityAt || before.activityAt || now,completedAt:after.status==='done'?(before.status==='done'?(after.completedAt!==before.completedAt?after.completedAt || now:before.completedAt || now):now):0}
}
export function canonicalCaptureUrl(value:string){try{const u=new URL(value);for(const key of [...u.searchParams.keys()])if(key==='t'||key==='start'||key.startsWith('utm_'))u.searchParams.delete(key);u.hash='';return u.toString()}catch{return value}}

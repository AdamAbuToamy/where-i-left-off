import {localParts,zonedTime,quietNow} from './policy.mjs'
const DAY=86400000
export function addDays(date,days){const d=new Date(`${date}T12:00Z`);d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)}
export function afterQuiet(p,at){
 if(!quietNow(p,at))return at
 const local=localParts(at,p.timezone)
 const date=p.quietStart>p.quietEnd&&local.time>=p.quietStart?addDays(local.date,1):local.date
 return zonedTime(date,p.quietEnd,p.timezone) || at+3600000
}
export function nextCheck(project,card,p,now,enabledAt,consumed=false,lastStaleDate=''){
 if(project.status==='done'||project.archivedAt||project.trashedAt||card.disabled)return now+DAY
 const times=[]
 if(p.due&&project.dueDate){
  let date=project.dueDate
  if(card.weekly){
   const today=localParts(now+p.leadMinutes*60000,p.timezone).date
   const start=new Date(`${date}T12:00Z`).getUTCDay(),d=new Date(`${today}T12:00Z`)
   d.setUTCDate(d.getUTCDate()-((d.getUTCDay()-start+7)%7));date=d.toISOString().slice(0,10)
   if(date<project.dueDate)date=project.dueDate
  }
  for(let i=0;i<(card.weekly?2:1);i++){
   const due=zonedTime(date,card.time || p.defaultTime,p.timezone)
   if(due!==null){const remind=due-p.leadMinutes*60000
    if(remind>=enabledAt && (!consumed || remind>now) && now-remind<DAY)times.push(afterQuiet(p,Math.max(now+1000,remind)))
   }
   date=addDays(date,7)
  }
 }
 if(p.stale){
  const last=Math.max(project.activityAt || project.updatedAt?.toMillis?.() || enabledAt,card.lastViewedAt || 0,enabledAt)
  const cutoff=Math.max(last+p.staleDays*DAY,(card.lastStaleAt || 0)+p.staleDays*DAY)
  let date=localParts(Math.max(now,cutoff),p.timezone).date
  let at=zonedTime(date,p.defaultTime,p.timezone)
  if(at===null || at<cutoff || lastStaleDate===date)at=zonedTime(addDays(date,1),p.defaultTime,p.timezone)
  if(at!==null)times.push(afterQuiet(p,Math.max(now+60000,at)))
 }
 return Math.min(now+DAY,...times)
}

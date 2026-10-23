import { createClientId } from '../lib/clientId'
import type { Course, UniversityState } from './model';
export function courseTemplate(course:Course,count:number,suffix='— فصل جديد' ):Course {
 return {id:createClientId(),name:course.name+' '+suffix,url:'',notes:course.notes,requires:[],topics:(course.topics||[]).map(t=>({id:createClientId(),title:t.title,done:false})),x:40+(count%3)*270,y:Math.min(10000,40+Math.floor(count/3)*160)};
}
export type DeletedStudyItem={kind:'courses'|'tasks'|'lessons';id:string;before:UniversityState};
export function restoreStudyItem(state:UniversityState,deleted:DeletedStudyItem):UniversityState {
 if(state[deleted.kind].some(x=>x.id===deleted.id))throw new Error('العنصر موجود بالفعل؛ لم نستبدل تعديلاته');
 const item=deleted.before[deleted.kind].find(x=>x.id===deleted.id);if(!item)throw new Error('العنصر غير موجود في نسخة التراجع');
 if(deleted.kind!=='courses'&&!state.courses.some(c=>c.id===(item as {courseId:string}).courseId))throw new Error('أعد الكورس المرتبط أولًا');
 const next={...state,[deleted.kind]:[...state[deleted.kind],item]} as UniversityState;
 if(deleted.kind==='courses')next.courses=next.courses.map(c=>{
  const old=deleted.before.courses.find(x=>x.id===c.id);
  return old?.requires.includes(deleted.id)&&!c.requires.includes(deleted.id)?{...c,requires:[...c.requires,deleted.id]}:c;
 });
 return next;
}
export function studyToday(state:UniversityState,now:Date){
 const date=(iso:string)=>{const d=new Date(iso);return [d.getFullYear(),d.getMonth(),d.getDate()].join('-');};
 const day=date(now.toISOString());
 return {lessons:state.lessons.filter(l=>l.day===now.getDay()).sort((a,b)=>a.start.localeCompare(b.start)),tasks:state.tasks.filter(t=>!t.done&&t.due&&date(t.due)===day).sort((a,b)=>Date.parse(a.due)-Date.parse(b.due)),overdue:state.tasks.filter(t=>!t.done&&t.due&&date(t.due)!==day&&Date.parse(t.due)<now.getTime()).sort((a,b)=>Date.parse(a.due)-Date.parse(b.due))};
}

export const sessionNames={lecture:'محاضرة',tutorial:'ترغول / تمرين',lab:'مختبر'};

import type { AssistantData,AssistantReply } from './actions';
import type { Language } from '../translations';
import { bulkTimetableReply,cleanCourseText,isTimetableList } from './bulkTimetable';
export type CourseMatchRequest={requested:string[];courses:{id:string;name:string;shortName?:string}[]};
/** Ask the cloud model to resolve identity only. The application retains every supplied time and type. */
export function courseMatchRequest(message:string,data:AssistantData,language:Language):CourseMatchRequest|null{
 if(!isTimetableList(message)||bulkTimetableReply(message,data,language)!==null)return null;
 const requested=[...new Set(message.split('\n').filter(line=>line.includes('|')).map(line=>cleanCourseText(line.split('|')[1]||'')).filter(Boolean))];
 if(!requested.length||requested.length>20)return null;
 return {requested,courses:data.study.courses.map(c=>({id:c.id,name:c.name,...(c.source?.shortName?{shortName:c.source.shortName}:{})}))};
}
const words={
 ar:{choose:'أحتاج تحديد الكورس المقصود قبل الحفظ:',none:'لم أجد كورسًا مرشحًا في البيانات المقروءة. الكورسات المتاحة:',match:'المطابقات المقترحة للكورسات:',available:'الكورسات المتاحة',missing:'لا توجد كورسات في بيانات الحساب المقروءة؛ تحقق من اكتمال مزامنة صفحة الجامعة.'},
 en:{choose:'Please identify the intended course before saving:',none:'No candidate was found in the account data. Available courses:',match:'Proposed course matches:',available:'Available courses',missing:'No courses were found in the account data. Check University sync.'},
 he:{choose:'נדרש לזהות את הקורס לפני שמירה:',none:'לא נמצא קורס מועמד בנתוני החשבון. הקורסים הזמינים:',match:'התאמות הקורסים המוצעות:',available:'קורסים זמינים',missing:'לא נמצאו קורסים בנתוני החשבון. בדקו את סנכרון עמוד האוניברסיטה.'},
};
export function resolvedTimetableReply(message:string,data:AssistantData,language:Language,request:CourseMatchRequest,text:string):AssistantReply{
 let raw:unknown;try{raw=JSON.parse(text.trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,''));}catch{throw new Error('assistant-format');}
 const value=raw as {matches?:unknown};
 if(!value||!Array.isArray(value.matches)||value.matches.length!==request.requested.length)throw new Error('assistant-format');
 const bindings=new Map<string,string>(),questions:string[]=[],t=words[language],seen=new Set<string>();
 for(const item of value.matches){
  if(!item||typeof item!=='object'||Array.isArray(item))throw new Error('assistant-format');
  const m=item as {requested:unknown;courseId:unknown;candidates:unknown};
  if(typeof m.requested!=='string'||!request.requested.includes(m.requested)||seen.has(m.requested)||typeof m.courseId!=='string'||!Array.isArray(m.candidates)||m.candidates.some(id=>typeof id!=='string'||!request.courses.some(c=>c.id===id)))throw new Error('assistant-invalid');
  seen.add(m.requested);
  if(m.courseId){if(!request.courses.some(c=>c.id===m.courseId))throw new Error('assistant-invalid');bindings.set(m.requested,m.courseId);}
  else{const candidates=request.courses.filter(c=>(m.candidates as string[]).includes(c.id));questions.push(`${m.requested}: ${candidates.length?candidates.map(c=>c.name).join(' / '):t.none+' '+request.courses.map(c=>c.name).join(' / ')}`);}
 }
 if(questions.length)return {text:t.choose+'\n'+questions.join('\n'),actions:[],files:[]};
 const reply=bulkTimetableReply(message,data,language,bindings);if(!reply)throw new Error('assistant-invalid');
 return {...reply,text:reply.text+'\n'+t.match+'\n'+[...bindings].map(([name,id])=>name+' ← '+request.courses.find(c=>c.id===id)!.name).join('\n')};
}
export function noCoursesReply(language:Language):AssistantReply{return {text:words[language].missing,actions:[],files:[]};}

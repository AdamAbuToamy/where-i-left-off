import type { Action, AssistantData, AssistantReply } from './actions';
import type { Language } from '../translations';
import { fold } from './text';

const days = [
 ['الاحد','sunday','יום ראשון'], ['الاثنين','monday','יום שני'],
 ['الثلاثاء','tuesday','יום שלישי'], ['الاربعاء','wednesday','יום רביעי'],
 ['الخميس','thursday','יום חמישי'], ['الجمعه','friday','יום שישי'], ['السبت','saturday','יום שבת'],
];
const words = {
 ar: {review:'حصص جاهزة للمراجعة',duplicate:'حصص مطابقة موجودة بالفعل',notSaved:'لم يُحفظ شيء بعد؛ اضغط تطبيق التغييرات لحفظ المقترح.',blocked:'لم يُنشأ مقترح جزئي. صحح الأسطر التالية:',course:'اسم الكورس غير موجود أو غير فريد',row:'صيغة الحصة أو اليوم أو الوقت أو النوع غير صالح',conflict:'توجد حصة بنفس الموعد ونوع مختلف؛ يلزم تحديد التعديل',limit:'الحد الأقصى 20 حصة في الطلب',empty:'لم أجد حصصًا صالحة في القائمة.'},
 en: {review:'Classes ready for review',duplicate:'Identical classes already present',notSaved:'Nothing has been saved yet. Click Apply changes to save the proposal.',blocked:'No partial proposal was created. Correct these rows:',course:'Course name is missing or ambiguous',row:'Invalid session format, day, time or type',conflict:'A session has the same time but a different type; specify the edit',limit:'At most 20 classes per request',empty:'No valid classes were found in the list.'},
 he: {review:'מפגשים מוכנים לבדיקה',duplicate:'מפגשים זהים שכבר קיימים',notSaved:'עדיין לא נשמר דבר. לחצו על החלת שינויים לשמירה.',blocked:'לא נוצרה הצעה חלקית. תקנו את השורות הבאות:',course:'שם הקורס חסר או אינו ייחודי',row:'מבנה מפגש, יום, שעה או סוג אינם תקינים',conflict:'קיים מפגש באותו מועד עם סוג שונה; יש לציין את השינוי',limit:'עד 20 מפגשים בבקשה',empty:'לא נמצאו מפגשים תקינים ברשימה.'},
};
export const cleanCourseText=(value:string)=>fold(value.replace(/[*_`]/g,'').replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g,''));
const validClock=(value:string)=>/^([01]\d|2[0-3]):[0-5]\d$/.test(value);
export function isTimetableList(message:string):boolean{
 const normalized=cleanCourseText(message);
 if(!normalized.includes('|')||!/(?:البرنامج|الجدول|timetable|schedule|מערכת)/.test(normalized))return false;
 if(!/(?:اضف|اضافه|تعبئه|امل[اأ]|add|fill|הוסף|להוסיף|מלא)/.test(normalized))return false;
 // Negative requests and illustrative/quoted schedules belong to the conversational path.
 if(/^(?:لا |do not |don't |אל |["“>])/.test(normalized))return false;
 if(message.split('\n').filter(line=>!line.includes('|')).some(line=>/(?:انشئ|أنشئ|احذف|أحذف|غير |غيّر|غيري|create (?:card|course)|delete |update |הוסף כרטיס|מחק |עדכן )/i.test(line)))return false;
 return true;
}
/** Explicit day headings and time | requested course name | type rows are imported atomically.
 * Prose is never interpreted as a database command; unresolved course names are delegated to the model, never rejected by spelling alone. */
export function bulkTimetableReply(message:string,data:AssistantData,language:Language,bindings?:Map<string,string>):AssistantReply|null {
 if(!isTimetableList(message))return null;
 const t=words[language],actions:Action[]=[],issues:string[]=[],seen=new Set<string>();let day=-1,duplicates=0,rows=0,needsMatching=false;
 for(const raw of message.split('\n')){
  const line=cleanCourseText(raw).replace(/^\s*[-•]\s*/, '');
  const heading=days.findIndex(names=>names.some(name=>line===name||line.startsWith(name+' —')||line.startsWith(name+' -')||line===name+':'));
  if(heading>=0){day=heading;continue;}
  if(!line.includes('|'))continue;
  rows++;
  const match=line.match(/^(\d{1,2}:\d{2})\s*[-–—]\s*(\d{1,2}:\d{2})\s*\|\s*(.+?)\s*\|\s*(.+)$/);
  if(!match||day<0){issues.push(`${t.row}: ${raw.trim()}`);continue;}
  const [,start,end,courseName,type]=match;
  const sessionType=/^(?:הרצאה(?: \(lecture\))?|lecture|محاضره)(?: — כיתה הפוכה)?$/.test(type)?'lecture':/^(?:תרגול(?: \(tutorial\))?|tutorial|تمرين|ترجول)$/.test(type)?'tutorial':/^(?:מעבדה(?: \(lab\))?|lab|مختبر)$/.test(type)?'lab':null;
  if(!validClock(start)||!validClock(end)||end<=start||!sessionType){issues.push(`${t.row}: ${raw.trim()}`);continue;}
  const bound=bindings?.get(courseName);
  const courses=data.study.courses.filter(c=>bound?c.id===bound:cleanCourseText(c.name)===courseName);
  if(courses.length!==1){needsMatching=true;continue;}
  const courseId=courses[0].id,key=JSON.stringify([courseId,day,start,end,sessionType]);
  const existing=data.study.lessons.find(l=>l.courseId===courseId&&l.day===day&&l.start===start&&l.end===end);
  if(existing&&(existing.sessionType||'lecture')!==sessionType){issues.push(`${t.conflict}: ${raw.trim()}`);continue;}
  if(existing||seen.has(key)){duplicates++;continue;}
  seen.add(key);
  actions.push({target:'lessons',action:'create',id:`new-session-${rows}`,values:{courseId,day,start,end,sessionType,room:'',...(type.endsWith(' — כיתה הפוכה')?{notes:'כיתה הפוכה'}:{})}});
 }
 if(rows>20)issues.push(t.limit);
 if(!rows)issues.push(t.empty);
 if(issues.length)return {text:t.blocked+'\n'+issues.join('\n'),actions:[],files:[]};
 if(needsMatching)return null;
 return {text:`${t.review}: ${actions.length}. ${t.duplicate}: ${duplicates}.\n${t.notSaved}`,actions,files:[]};
}

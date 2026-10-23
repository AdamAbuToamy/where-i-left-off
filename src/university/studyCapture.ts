import { createClientId } from '../lib/clientId'
import type { CourseDetails, Course, StudyTask, UniversityState } from './model';
export type StudyCapture = {
  version: 1;
  due?:string;
  dates?:{label:string;text:string;iso:string;type:string;timezone:string}[];
  description?:string;
  materials?:{title:string;url:string}[];
  teachers?:string[];
  kind: 'course' | 'assignment' | 'exam';
  courseName: string;
  courseUrl: string;
  title: string;
  url: string;
};
/** Only canonical Moodle course/activity links may cross the capture boundary. */
export function parseStudyCapture(hash: string): StudyCapture | null {
  try {
    const raw = new URLSearchParams(hash.split('?')[1] || '').get('studyCapture');
    if (!raw || raw.length > 120000) return null;
    const r = JSON.parse(raw);
    if (r.version !== 1 || !['course', 'assignment', 'exam'].includes(r.kind)) return null;
    for (const [field, max] of [['courseName', 300], ['title', 500], ['url', 2000], ['courseUrl', 2000]] as const) {
      if (typeof r[field] !== 'string' || !r[field].trim() || r[field].length > max) return null;
    }
    const course = new URL(r.courseUrl), page = new URL(r.url);
    const pattern = /^(.*)\/course\/view\.php$/;
    const match = course.pathname.match(pattern);
    if (!match || course.protocol !== 'https:' || page.origin !== course.origin || course.username || course.password || page.username || page.password || course.hash || page.hash) return null;
    for (const u of [course,page]) {
      if ([...u.searchParams.keys()].length !== 1 || !/^\d+$/.test(u.searchParams.get('id') || '')) return null;
    }
    const expected = match[1] + (r.kind === 'course' ? '/course/view.php' : r.kind === 'exam' ? '/mod/quiz/view.php' : '/mod/assign/view.php');
    if (page.pathname !== expected || r.kind === 'course' && page.href !== course.href) return null;
    const extras:Partial<StudyCapture>={};
    if(typeof r.due==='string'&&r.due.length<40&&Number.isFinite(Date.parse(r.due)))extras.due=new Date(r.due).toISOString();
    if(typeof r.description==='string')extras.description=r.description.slice(0,5000);
    if(Array.isArray(r.teachers))extras.teachers=r.teachers.filter((x:unknown)=>typeof x==='string').slice(0,20).map((x:string)=>x.slice(0,200));
    if(Array.isArray(r.dates))extras.dates=r.dates.slice(0,12).map((x:Record<string,unknown>)=>({label:String(x.label||'').slice(0,150),text:String(x.text||'').slice(0,500),iso:typeof x.iso==='string'&&Number.isFinite(Date.parse(x.iso))?new Date(x.iso).toISOString():'',type:['due','opens','other'].includes(String(x.type))?String(x.type):'other',timezone:String(x.timezone||'').slice(0,100)}));
    if(Array.isArray(r.materials))extras.materials=r.materials.slice(0,30).flatMap((x:Record<string,unknown>)=>{try{const u=new URL(String(x.url));if(u.origin!==course.origin||u.protocol!=='https:'||u.username||u.password||[...u.searchParams.keys()].some(k=>/token|sesskey|password|secret/i.test(k)))return [];return [{title:String(x.title||'').slice(0,300),url:u.href.slice(0,2000)}];}catch{return [];}});
    return {version:1, kind:r.kind, courseName:r.courseName.trim(), title:r.title.trim(), courseUrl:course.href, url:page.href,...extras};
  } catch { return null; }
}
function sameLink(a: string,b: string): boolean {
  try { const x=new URL(a),y=new URL(b);return x.origin===y.origin&&x.pathname===y.pathname&&x.searchParams.get('id')===y.searchParams.get('id'); } catch { return false; }
}
export function captureMatches(state:UniversityState,capture:StudyCapture) {
  const course = state.courses.find(c=>sameLink(c.url,capture.courseUrl));
  const suggested = !course ? state.courses.filter(c=>c.name.trim().toLocaleLowerCase()===capture.courseName.toLocaleLowerCase()) : [];
  const task = state.tasks.find(t=>sameLink(t.url,capture.url));
  return {course,suggested:suggested.length===1?suggested[0]:undefined,task};
}
function capturedCourseDetails(capture:StudyCapture):CourseDetails {
 return {shortName:'',description:capture.kind==='course'?capture.description||'':'',teachers:capture.teachers||[],status:'partial',warnings:[],sections:capture.materials?.length?[{id:'captured-links',title:capture.courseName,description:'',activities:capture.materials.map((m,i)=>({id:'link-'+i,title:m.title,kind:'url',url:m.url,description:'',completed:null}))}]:[]};
}
/** Builds records only after explicit confirmation. Existing records are opened, never overwritten. */
export function acceptStudyCapture(state:UniversityState,capture:StudyCapture,input:{courseId:string;createCourse:boolean;courseName:string;title:string;due:string;updateExisting?:boolean}):{state:UniversityState;course:Course;task?:StudyTask} {
  const matches=captureMatches(state,capture);
  if(matches.task&&capture.kind!=='course') {
    if(input.updateExisting){
      const old=matches.task;const task={...old,title:input.title.trim()||old.title,due:input.due?new Date(input.due).toISOString():old.due,sourceDescription:[capture.description||'',...(capture.dates||[]).map(d=>d.label+' '+d.text),...(capture.materials||[]).map(m=>m.title+' — '+m.url)].filter(Boolean).join('\n').slice(0,5000)};
      if(task.title.length>500||(task.due&&!Number.isFinite(Date.parse(task.due))))throw new Error('أضف موعدًا صحيحًا');
      const course=state.courses.find(c=>c.id===task.courseId);if(!course)throw new Error('الكورس المرتبط بالمهمة غير موجود');
      return {state:{...state,tasks:state.tasks.map(t=>t.id===task.id?task:t)},course,task};
    }
    const course=state.courses.find(c=>c.id===matches.task!.courseId);
    if(!course)throw new Error('الكورس المرتبط بالمهمة غير موجود');
    return {state,course,task:matches.task};
  }
  let course=matches.course||state.courses.find(c=>c.id===input.courseId);
  if(!course) {
    if(!input.createCourse)throw new Error('اختر كورسًا أو وافق على إنشاء كورس جديد');
    const name=input.courseName.trim();if(!name||name.length>300)throw new Error('أضف اسم كورس صحيحًا');
    const n=state.courses.length;
    course={id:createClientId(),name,url:capture.courseUrl,notes:'',source:capturedCourseDetails(capture),requires:[],topics:[],x:40+(n%3)*270,y:Math.min(10000,40+Math.floor(n/3)*160)};
  }
  if (!course.url) course={...course,url:capture.courseUrl};
  const courses=state.courses.some(c=>c.id===course!.id)?state.courses.map(c=>c.id===course!.id?course!:c):[...state.courses,course];
  if(capture.kind==='course')return {state:{...state,courses},course};
  const title=input.title.trim();if(!title||title.length>500)throw new Error('أضف عنوان المهمة');
  if(input.due&&!Number.isFinite(Date.parse(input.due)))throw new Error('أضف موعدًا صحيحًا');
  const task:StudyTask={id:createClientId(),courseId:course.id,title,kind:capture.kind,due:input.due?new Date(input.due).toISOString():'',notes:'',done:false,url:capture.url,sourceDescription:[capture.description||'',...(capture.dates||[]).map(d=>d.label+' '+d.text),...(capture.materials||[]).map(m=>m.title+' — '+m.url)].filter(Boolean).join('\n').slice(0,5000)};
  return {state:{...state,courses,tasks:[...state.tasks,task]},course,task};
}

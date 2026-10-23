import StudyLocalized from "./StudyLocale";
import { toLocalInput } from './model';
import { useState } from 'react';
import type { UniversityState } from './model';
import { captureMatches } from './studyCapture';
import type { StudyCapture } from './studyCapture';
export type CaptureChoice = {courseId:string;createCourse:boolean;courseName:string;title:string;due:string;updateExisting?:boolean};
export default function StudyCaptureReview({capture,state,busy,confirm,cancel}:{capture:StudyCapture;state:UniversityState;busy:boolean;confirm:(input:CaptureChoice)=>void;cancel:()=>void}) {
  const matches=captureMatches(state,capture);
  const [courseId,setCourseId]=useState(matches.course?.id||matches.suggested?.id||'');
  const [updateExisting,setUpdateExisting]=useState(false);
  const duplicate=capture.kind==='course'?matches.course:matches.task;
  return <StudyLocalized>{<form className="study-capture-review" onSubmit={e=>{
    e.preventDefault();const f=new FormData(e.currentTarget);
    confirm({courseId,createCourse:!courseId,courseName:String(f.get('courseName')||capture.courseName),title:String(f.get('title')||capture.title),due:String(f.get('due')||''),updateExisting});
  }}>
    <span className="study-capture-badge">تم التعرّف على صفحة Moodle</span>
    <h3 dir="auto">{capture.title}</h3>
    <p>{capture.kind==='course'?'هل تريد إضافة هذا الكورس إلى خطة الفصل؟':'هل تريد إضافة '+(capture.kind==='exam'?'هذا الاختبار':'هذه الوظيفة')+' إلى أحد كورساتك؟'}</p>
    <p className="study-hint" dir="auto">{capture.courseName} · {new URL(capture.url).hostname}</p>
    {duplicate&&!updateExisting?<><p role="status">هذا {capture.kind==='course'?'الكورس':'العنصر'} محفوظ لديك بالفعل. يمكنك فتحه وتعديله دون إنشاء نسخة أخرى.</p>{capture.kind!=='course'&&<button type="button" onClick={()=>setUpdateExisting(true)}>مراجعة تحديث من الصفحة</button>}</>:<>
      {!matches.course&&<label>الكورس في خطتك<select value={courseId} onChange={e=>setCourseId(e.target.value)}>
        <option value="">إنشاء كورس جديد من هذه الصفحة</option>
        {state.courses.map(c=><option data-study-content="true" key={c.id} value={c.id}>{c.name}</option>)}
      </select></label>}
      {matches.course&&<p>الكورس المرتبط: <strong dir="auto">{matches.course.name}</strong></p>}
      {matches.suggested&&!matches.course&&<p className="study-hint">وجدنا اسمًا مطابقًا. تحقّق من اختيار الكورس؛ المطابقة بالاسم وحده لا تثبت أنه الكورس نفسه.</p>}
      {!courseId&&!matches.course&&<label>اسم الكورس الجديد<input name="courseName" defaultValue={capture.courseName} required maxLength={300} dir="auto"/></label>}
      {capture.kind!=='course'&&<>
        <label>عنوان المهمة<input name="title" defaultValue={matches.task?.title||capture.title} required maxLength={500} dir="auto"/></label>
        <label>موعد التسليم (اختياري)<input name="due" type="datetime-local" defaultValue={capture.due?toLocalInput(capture.due):''}/></label>
        <p className="study-hint">{capture.due?'التُقط موعد من الصفحة. راجع الساعة والمنطقة الزمنية قبل الحفظ.':'لم نستطع تحويل الموعد إلى تاريخ مؤكد. راجع التواريخ المقروءة أدناه وأدخل الموعد.'} تذكير الهاتف يُفعّل باختيار منفصل.</p>
      </>}
    </>}
    {capture.description&&<details><summary>الوصف المقروء</summary><p dir="auto">{capture.description}</p></details>}
    {!!capture.dates?.length&&<details open><summary>المواعيد المقروءة من الصفحة</summary>{capture.dates.map((d,i)=><p key={i} dir="auto"><strong>{d.label}</strong> {d.text} {d.iso&&<small> · {d.timezone}</small>}</p>)}</details>}
    {!!capture.materials?.length&&<details><summary>الروابط والمواد</summary>{capture.materials.map(m=><p key={m.url}><a href={m.url} target="_blank" rel="noopener noreferrer" dir="auto">{m.title}</a></p>)}</details>}
    <a href={capture.url} target="_blank" rel="noopener noreferrer">مراجعة الصفحة الأصلية</a>
    <div className="study-form-actions"><button className="primary-button" disabled={busy}>{duplicate&&!updateExisting?'فتح المحفوظ':courseId||matches.course?'تأكيد الإضافة':'إضافة الكورس'+(capture.kind==='course'?'':' والمهمة')}</button><button type="button" disabled={busy} onClick={cancel}>إلغاء</button></div>
    {capture.url.length<=500&&<a href={'/?capture=tab&title='+encodeURIComponent(capture.title)+'&url='+encodeURIComponent(capture.url)+'#/personal'}>حفظ كبطاقة عادية بدلًا من الجامعة</a>}
    <p className="study-hint">لا يُحفظ شيء قبل موافقتك. هذا التقاط للصفحة الحالية، وليس مزامنة تلقائية.</p>
  </form>}</StudyLocalized>;
}

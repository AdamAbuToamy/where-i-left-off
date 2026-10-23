import { createClientId } from '../lib/clientId'
import StudyLocalized from "./StudyLocale";
import { useMemo, useState } from 'react';
import type { Lesson, UniversityState } from './model';
import { lessonConflicts } from './planImport';
const days=['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
import { sessionNames } from './studyTools';
type Row={id:string;courseId:string;sessionType:NonNullable<Lesson['sessionType']>;days:number[];start:string;end:string;room:string};
export default function WeeklyScheduleEditor({state,busy,save}:{state:UniversityState;busy:boolean;save:(lessons:Lesson[])=>void}){
 const blank=():Row=>({id:createClientId(),courseId:state.courses[0]?.id||'',sessionType:'lecture',days:[0],start:'09:00',end:'10:00',room:''});
 const [rows,setRows]=useState<Row[]>(()=>state.lessons.length?state.lessons.map(l=>({...l,sessionType:l.sessionType||'lecture',days:[l.day]})):[blank()]);
 const [error,setError]=useState('');
 function change(id:string,patch:Partial<Row>){setRows(old=>old.map(r=>r.id===id?{...r,...patch}:r));}
 const preview=useMemo(()=>rows.flatMap(r=>r.days.map((day,index)=>({id:index===0?r.id:r.id+'-'+day,courseId:r.courseId,sessionType:r.sessionType,day,start:r.start,end:r.end,room:r.room}))),[rows]);
 const conflicts=lessonConflicts(preview);
 return <StudyLocalized>{<form className="study-week-editor" onSubmit={e=>{e.preventDefault();try{
  if(rows.some(r=>!r.days.length||!state.courses.some(c=>c.id===r.courseId)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(r.start)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(r.end)||r.end<=r.start))throw new Error('اختر كورسًا ويومًا لكل لقاء، وتأكد أن وقت النهاية بعد البداية.');
  if(preview.length>2000)throw new Error('عدد اللقاءات أكبر من المسموح');
  save(preview.map(l=>({...l,id:state.lessons.some(old=>old.id===l.id)?l.id:createClientId()})));
 }catch(e){setError((e as Error).message);}}}>
  <p>كل صف لقاء أسبوعي. اختر عدة أيام إذا كان النوع والوقت والقاعة نفسها. يمكنك تعديل الجدول الحالي كاملًا؛ لا يُحفظ شيء قبل التأكيد.</p>
  {rows.map((r,index)=><fieldset className="study-week-row" key={r.id}><legend>لقاء {index+1}</legend>
   <div className="study-form-grid"><label>الكورس<select value={r.courseId} onChange={e=>change(r.id,{courseId:e.target.value})} required>{state.courses.map(c=><option data-study-content="true" key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>نوع اللقاء<select value={r.sessionType} onChange={e=>change(r.id,{sessionType:e.target.value as Row['sessionType']})}>{Object.entries(sessionNames).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label></div>
   <fieldset className="study-week-days"><legend>أيام اللقاء</legend>{days.map((name,day)=><label key={day}><input type="checkbox" checked={r.days.includes(day)} onChange={e=>change(r.id,{days:e.target.checked?[...r.days,day].sort():r.days.filter(d=>d!==day)})}/>{name}</label>)}</fieldset>
   <div className="study-form-grid"><label>من<input type="time" required value={r.start} onChange={e=>change(r.id,{start:e.target.value})}/></label><label>إلى<input type="time" required value={r.end} onChange={e=>change(r.id,{end:e.target.value})}/></label></div>
   <label>الغرفة / القاعة<input value={r.room} maxLength={200} placeholder="مثال: مبنى 90، قاعة 204" onChange={e=>change(r.id,{room:e.target.value})}/></label>
   <div className="study-form-actions"><button type="button" onClick={()=>setRows(old=>[...old,{...r,id:createClientId(),days:[...r.days]}])}>تكرار الصف</button><button type="button" onClick={()=>setRows(old=>old.filter(x=>x.id!==r.id))}>إزالة الصف</button></div>
  </fieldset>)}
  <button type="button" onClick={()=>setRows(old=>[...old,blank()])}>إضافة لقاء آخر</button>
  {conflicts.size>0&&<p className="study-overdue" role="status">يوجد تداخل بين {conflicts.size} لقاءات. راجع الأيام والأوقات؛ يمكنك حفظ التداخل إذا كان مقصودًا.</p>}
  {error&&<p role="alert" className="study-error">{error}</p>}
  <button className="primary-button" disabled={busy||!state.courses.length}>حفظ جدول الأسبوع · {preview.length} لقاءات</button>
 </form>}</StudyLocalized>;
}

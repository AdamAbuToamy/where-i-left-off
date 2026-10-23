import StudyLocalized from "./StudyLocale";
import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import type { Language } from '../translations';
import { db } from '../lib/firebase';
import { UniversityStore, emptyUniversity } from './model';
import { useStudySync } from './useStudySync';
import { studyToday } from './studyTools';
import './university.css';
const words={ar:{title:'اليوم في الجامعة',lessons:'محاضرات اليوم',tasks:'تسليمات اليوم',late:'متأخر',empty:'لا توجد مواعيد جامعية لهذا اليوم.',open:'فتح خطة الفصل'},en:{title:'University today',lessons:"Today's classes",tasks:'Due today',late:'Overdue',empty:'No university deadlines or classes today.',open:'Open semester plan'},he:{title:'היום באוניברסיטה',lessons:'השיעורים היום',tasks:'להגשה היום',late:'באיחור',empty:'אין שיעורים או מועדי הגשה להיום.',open:'פתיחת תוכנית הסמסטר'}};
export default function StudyToday({user,language}:{user:User;language:Language}){
 const [store]=useState(()=>new UniversityStore(user.uid,db!.app.options.projectId||'local'));
 const [state,setState]=useState(()=>{try{return store.load();}catch{return emptyUniversity();}});
 const [now,setNow]=useState(()=>new Date());
 const cloud=useStudySync(store,user.uid,setState);
 useEffect(()=>{const timer=setInterval(()=>setNow(new Date()),30000);return()=>clearInterval(timer);},[]);
 const t=words[language],today=studyToday(state,now),name=(id:string)=>state.courses.find(c=>c.id===id)?.name||'';
 return <StudyLocalized>{<section className="study-today" dir={language==='en'?'ltr':'rtl'} aria-label={t.title}>
  <header><h3>{t.title}</h3><a href="#/university">{t.open} ↗</a></header>
  {cloud.status.error&&<p role="status">{cloud.status.error}</p>}
  {!today.lessons.length&&!today.tasks.length&&!today.overdue.length&&<p>{t.empty}</p>}
  <div className="study-today-grid">
   {!!today.lessons.length&&<section><h4>{t.lessons}</h4>{today.lessons.map(l=><a className="study-today-row" href={'#/university?lesson='+encodeURIComponent(l.id)} key={l.id}><strong dir="auto">{name(l.courseId)}</strong><time dir="ltr">{l.start}–{l.end}</time><span dir="auto">{l.room}</span></a>)}</section>}
   {!!today.tasks.length&&<section><h4>{t.tasks}</h4>{today.tasks.map(task=><a className="study-today-row" href={'#/university?task='+encodeURIComponent(task.id)} key={task.id}><strong dir="auto">{task.title}</strong><span dir="auto">{name(task.courseId)}</span><time>{new Date(task.due).toLocaleTimeString(language,{hour:'2-digit',minute:'2-digit'})}</time></a>)}</section>}
   {!!today.overdue.length&&<section><h4>{t.late} · {today.overdue.length}</h4>{today.overdue.slice(0,5).map(task=><a className="study-today-row is-overdue" href={'#/university?task='+encodeURIComponent(task.id)} key={task.id}><strong dir="auto">{task.title}</strong><span dir="auto">{name(task.courseId)}</span><time>{new Date(task.due).toLocaleDateString(language)}</time></a>)}</section>}
  </div>
 </section>}</StudyLocalized>;
}

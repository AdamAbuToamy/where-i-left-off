import type { CSSProperties } from 'react';
import type { Language } from '../translations';
import type { Course,Lesson } from './model';
import { layoutTimetableDay,timetableBounds,hourLabel,TIMETABLE_HOUR_HEIGHT } from './timetableLayout';
import './timetable.css';
const words={
 ar:{title:'الجدول الأسبوعي حسب الساعات',hour:'الساعة',hint:'اضغط على الحصة لتعديلها. مرّر داخل الجدول لرؤية بقية الأيام والساعات.',days:['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'],types:{lecture:'محاضرة',tutorial:'ترغول / تمرين',lab:'مختبر'}},
 en:{title:'Weekly timetable by hour',hour:'Time',hint:'Select a class to edit it. Scroll within the timetable to see more days and hours.',days:['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],types:{lecture:'Lecture',tutorial:'Tutorial',lab:'Lab'}},
 he:{title:'מערכת שעות שבועית',hour:'שעה',hint:'לחצו על מפגש לעריכה. גללו בתוך המערכת כדי לראות ימים ושעות נוספים.',days:['יום ראשון','יום שני','יום שלישי','יום רביעי','יום חמישי','יום שישי','שבת'],types:{lecture:'הרצאה',tutorial:'תרגול',lab:'מעבדה'}},
};
type Props={lessons:Lesson[];courses:Course[];courseFilter:string;conflicts:Set<string>;language:Language;courseColor:(id:string)=>string;onEdit:(lesson:Lesson)=>void};
export default function Timetable({lessons,courses,courseFilter,conflicts,language,courseColor,onEdit}:Props){
 const t=words[language],bounds=timetableBounds(lessons),names=new Map(courses.map(c=>[c.id,c.name]));
 return <>
  <div className="study-timetable-scroll" role="region" aria-label={t.title} tabIndex={0} dir={language==='en'?'ltr':'rtl'}>
   <div className="study-week study-time-grid" style={{'--study-hour-height':`${TIMETABLE_HOUR_HEIGHT}px`,'--study-half-hour-height':`${TIMETABLE_HOUR_HEIGHT/2}px`} as CSSProperties}>
    <div className="study-time-axis" aria-hidden="true"><h3>{t.hour}</h3><div className="study-time-axis-track" style={{height:bounds.height}}>{bounds.hours.map(hour=><span key={hour} className="study-hour-label" style={{top:(hour-bounds.start)*TIMETABLE_HOUR_HEIGHT/60}} dir="ltr">{hourLabel(hour)}</span>)}</div></div>
    {t.days.map((day,index)=><section key={index} aria-label={day}><h3>{day}</h3><div className="study-day-track" style={{height:bounds.height}}>
     {layoutTimetableDay(lessons.filter(l=>l.day===index&&(!courseFilter||l.courseId===courseFilter)),bounds.start).map(({lesson,top,height,lane,lanes})=>{
      const course=names.get(lesson.courseId)||'',type=t.types[lesson.sessionType||'lecture'];
      const label=[course,day,lesson.start+'–'+lesson.end,type,lesson.room,lesson.notes].filter(Boolean).join(' · ');
      return <button data-study-lesson={lesson.id} type="button" key={lesson.id} className={`study-lesson study-hour-lesson${conflicts.has(lesson.id)?' has-conflict':''}${height<TIMETABLE_HOUR_HEIGHT?' is-short':''}`} aria-label={label} title={label} style={{top:top+2,height:Math.max(1,height-4),insetInlineStart:`calc(${lane*100/lanes}% + 3px)`,width:`calc(${100/lanes}% - 6px)`,borderColor:courseColor(lesson.courseId)}} onClick={()=>onEdit(lesson)}>
       <time dir="ltr">{lesson.start} — {lesson.end}</time><strong dir="auto" data-study-content="true">{course}</strong><small>{type}</small>{lesson.room&&<small dir="auto" data-study-content="true">{lesson.room}</small>}{lesson.notes&&<small dir="auto" data-study-content="true">{lesson.notes}</small>}
      </button>;
     })}
    </div></section>)}
   </div>
  </div>
 </>;
}

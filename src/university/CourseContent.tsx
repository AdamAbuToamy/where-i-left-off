import StudyLocalized from "./StudyLocale";
import type { Course } from './model';
export default function CourseContent({ course, busy, onToggleTopic }: {
    course: Course;
    busy: boolean;
    onToggleTopic: (id: string) => void;
}) {
    const topics = course.topics || [], done = topics.filter(t => t.done).length, source = course.source;
    return <StudyLocalized>{<div className="study-course-content">
  <details open={topics.length > 0}>
   <summary>خطة الدراسة{topics.length > 0 ? ` · ${done}/${topics.length}` : ''}</summary>
   {topics.length ? <>
    <progress max={topics.length} value={done} aria-label={`تقدم الدراسة في ${course.name}`}/>
    <ul className="study-topic-list">{topics.map(t => <li key={t.id}><label className={t.done ? 'is-done' : ''}><input type="checkbox" checked={t.done} disabled={busy} onChange={() => onToggleTopic(t.id)}/><span dir="auto">{t.title}</span></label></li>)}</ul>
   </> : <p className="study-hint">من «تعديل الكورس» أضف مواضيع المحاضرات أو السيلابوس؛ كل موضوع في سطر، وأشّر ما أنجزته.</p>}
  </details>
  {source && <details className="study-saved-materials"><summary>مواد محفوظة سابقًا</summary>
   {source.shortName && <p dir="auto">{source.shortName}</p>}
   {!!source.teachers.length && <p dir="auto">المحاضرون: {source.teachers.join(' · ')}</p>}
   {source.description && <p dir="auto">{source.description}</p>}
   {source.sections.map(s => <details key={s.id}><summary dir="auto">{s.title}</summary>{s.description && <p dir="auto">{s.description}</p>}<ul>{s.activities.map(a => <li key={a.id}>{a.url ? <a href={a.url} target="_blank" rel="noopener" dir="auto">{a.title}</a> : <span dir="auto">{a.title}</span>}{a.description && <p dir="auto">{a.description}</p>}</li>)}</ul></details>)}
  </details>}
 </div>}</StudyLocalized>;
}

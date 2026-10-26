import LinkedText from '../components/LinkedText';
import CourseContent from './CourseContent';
import StudyLocalized from './StudyLocale';
import type { Course } from './model';
export default function CourseDetails({course, color, pendingCount, busy, onEdit, onTemplate, onToggleTopic}: {
    course: Course; color: string; pendingCount: number; busy: boolean;
    onEdit: () => void; onTemplate: () => void; onToggleTopic: (id: string) => void;
}) {
    return <StudyLocalized><article data-study-course={course.id} className="study-course" style={{borderInlineStartColor:color}}>
        <h3 dir="auto">{course.name}</h3>
        <small>{pendingCount} <span>مهام مفتوحة</span></small>
        {course.notes && <section className="study-course-notes"><h4>ملاحظات الكورس</h4><p dir="auto"><LinkedText text={course.notes}/></p></section>}
        <div>
            <button className="study-link-button" onClick={onEdit}>تعديل الكورس</button>
            <button className="study-link-button" onClick={onTemplate}>استخدام كقالب</button>
            {course.url && <a href={course.url} target="_blank" rel="noopener noreferrer">فتح الكورس</a>}
        </div>
        <CourseContent course={course} busy={busy} onToggleTopic={onToggleTopic}/>
    </article></StudyLocalized>;
}

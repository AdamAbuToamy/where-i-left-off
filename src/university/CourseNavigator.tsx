import { useState } from 'react';
import type { Course, StudyTask } from './model';
import StudyLocalized from './StudyLocale';

const PAGE_SIZE = 6;
export default function CourseNavigator({courses, tasks, selectedId, filter, onSelect, courseColor, onAdd}: {
    courses: Course[]; tasks: StudyTask[]; selectedId: string; filter: string;
    onSelect: (id: string) => void; courseColor: (id: string) => string; onAdd: () => void;
}) {
    // Firestore snapshots can reorder records; keep page membership stable as sync completes.
    const ordered = [...courses].sort((a,b) => a.name.localeCompare(b.name, undefined, {numeric:true}) || a.id.localeCompare(b.id));
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(() => Math.floor(Math.max(0, ordered.findIndex(c => c.id === selectedId)) / PAGE_SIZE));
    const matches = ordered.filter(c => c.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
    const pages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
    const current = Math.min(page, pages - 1);
    return <StudyLocalized><aside className="study-course-browser">
        <h3>كورساتي</h3>
        {!courses.length ? <div className="study-empty"><strong>كورساتك تبدأ هنا</strong><p>أضف كورسًا، أو الصق أسماء كورسات الفصل دفعة واحدة.</p><button className="secondary-button" onClick={onAdd}>لصق قائمة كورسات</button></div> : <>
            <label className="study-course-search">بحث عن كورس<input type="search" value={search} onChange={e => {setSearch(e.target.value); setPage(0);}}/></label>
            <button className="study-all-courses" aria-pressed={!filter} onClick={() => onSelect('')}>كل الكورسات</button>
            <div className="study-course-choices">
                {matches.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE).map(c => <button key={c.id} className="study-course-choice" aria-pressed={selectedId === c.id} onClick={() => onSelect(c.id)} style={{borderInlineStartColor: courseColor(c.id)}}>
                    <span className="study-course-choice-title"><strong dir="auto">{c.name}</strong>{selectedId === c.id && <span className="study-current-course">الكورس المفتوح</span>}</span>
                    <small>{tasks.filter(t => t.courseId === c.id && !t.done).length} <span>مهام مفتوحة</span></small>
                </button>)}
                {!matches.length && <p>لا توجد كورسات مطابقة</p>}
            </div>
            {pages > 1 && <nav className="study-course-pages" aria-label="صفحات الكورسات">
                <button disabled={current === 0} onClick={() => setPage(current - 1)}>السابق</button>
                <span aria-live="polite">{current + 1} / {pages}</span>
                <button disabled={current === pages - 1} onClick={() => setPage(current + 1)}>التالي</button>
            </nav>}
        </>}
    </aside></StudyLocalized>;
}

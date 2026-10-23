import { createClientId } from '../lib/clientId'
import { resourceUrl, validateCourse } from './model';
import type { Course, CourseDetails, Lesson, StudyTask, UniversityState } from './model';
export type ImportMode = 'courses' | 'tasks' | 'lessons';
export type PlanPreview = {
    courses: Course[];
    tasks: StudyTask[];
    lessons: Lesson[];
    errors: string[];
    skipped: number;
};
const fold = (s: string) => s.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
const blank = (): PlanPreview => ({ courses: [], tasks: [], lessons: [], errors: [], skipped: 0 });
function text(v: unknown, max = 10000): string { if (typeof v !== 'string' || v.length > max)
    throw new Error('نص غير صالح أو طويل جدًا'); return v; }
function obj(v: unknown): Record<string, unknown> { if (!v || typeof v !== 'object' || Array.isArray(v))
    throw new Error('بيانات غير صالحة'); return v as Record<string, unknown>; }
function array(v: unknown, max: number): unknown[] { if (!Array.isArray(v) || v.length > max)
    throw new Error('عدد السجلات أكبر من المسموح'); return v; }
function id(v: unknown): string { const s = text(v, 600); if (!/^[\w-]+$/.test(s))
    throw new Error('معرّف غير صالح'); return s; }
function bool(v: unknown): boolean { if (typeof v !== 'boolean')
    throw new Error('حالة غير صالحة'); return v; }
function integer(v: unknown, min: number, max: number): number { if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max)
    throw new Error('رقم غير صالح'); return v; }
function clock(v: unknown): string { const s = text(v, 5); if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(s))
    throw new Error('الوقت بصيغة HH:MM'); return s; }
function kind(v: string): StudyTask['kind'] {
    const k = fold(v || 'task');
    if (['وظيفة', 'واجب', 'assignment'].includes(k))
        return 'assignment';
    if (['امتحان', 'اختبار', 'exam', 'מבחן'].includes(k))
        return 'exam';
    if (['مهمة', 'task', 'מטלה'].includes(k))
        return 'task';
    throw new Error('النوع: مهمة أو وظيفة أو امتحان');
}
function localDue(s: string): string {
    if (!s)
        return '';
    const input = /^\d{4}-\d{2}-\d{2}$/.test(s) ? s + 'T09:00' : s.replace(' ', 'T');
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(input))
        throw new Error('الموعد بصيغة YYYY-MM-DD HH:MM');
    clock(input.slice(11));
    const d = new Date(input);
    if (!Number.isFinite(d.getTime()) || d.getFullYear() !== Number(input.slice(0, 4)) || d.getMonth() + 1 !== Number(input.slice(5, 7)) || d.getDate() !== Number(input.slice(8, 10)) || d.getHours() !== Number(input.slice(11, 13)) || d.getMinutes() !== Number(input.slice(14)))
        throw new Error('التاريخ أو الساعة غير موجودين');
    return d.toISOString();
}
const dayNames = [['الأحد', 'الاحد', 'sunday', 'א', 'ראשון'], ['الاثنين', 'الإثنين', 'monday', 'ב', 'שני'], ['الثلاثاء', 'tuesday', 'ג', 'שלישי'], ['الأربعاء', 'الاربعاء', 'wednesday', 'ד', 'רביעי'], ['الخميس', 'thursday', 'ה', 'חמישי'], ['الجمعة', 'friday', 'ו', 'שישי'], ['السبت', 'saturday', 'שבת']];
function day(value: string): number { if (/^[0-6]$/.test(value))
    return Number(value); const d = dayNames.findIndex(names => names.includes(fold(value))); if (d < 0)
    throw new Error('اكتب اسم اليوم أو رقمه: الأحد 0 حتى السبت 6'); return d; }
export function parsePlanText(raw: string, mode: ImportMode, state: UniversityState): PlanPreview {
    const out = blank();
    if (raw.length > 200000)
        return { ...out, errors: ['النص أكبر من المسموح'] };
    const lines = raw.split(/\r?\n/).map((s, i) => ({ s, i })).filter(l => l.s.trim());
    if (lines.length > 500)
        return { ...out, errors: ['أضف حتى 500 سطر في كل دفعة'] };
    const names = new Map(state.courses.map(c => [fold(c.name), c]));
    for (const { s, i } of lines) {
        try {
            const columns = s.split(s.includes('\t') ? '\t' : '|').map(v => v.trim());
            if (columns.some(c => c.length > 10000))
                throw new Error('الحقل أطول من المسموح');
            if (mode === 'courses') {
                if (columns.length > 3)
                    throw new Error('الأعمدة: اسم الكورس | رابط اختياري | ملاحظات اختيارية');
                const [name, url = '', notes = ''] = columns;
                if (!name || name.length > 300)
                    throw new Error('أضف اسم كورس حتى 300 حرف');
                if (names.has(fold(name))) {
                    out.skipped++;
                    continue;
                }
                const n = state.courses.length + out.courses.length;
                const course: Course = { id: createClientId(), name, url: resourceUrl(url), notes, requires: [], topics: [], x: 40 + (n % 3) * 270, y: Math.min(10000, 40 + Math.floor(n / 3) * 160) };
                out.courses.push(course);
                names.set(fold(name), course);
            }
            else {
                const course = names.get(fold(columns[0]));
                if (!course)
                    throw new Error('الكورس غير موجود؛ أضفه أولًا بنفس الاسم');
                if (mode === 'tasks') {
                    if (columns.length < 2 || columns.length > 5)
                        throw new Error('الأعمدة: الكورس | العنوان | الموعد | النوع | الملاحظات');
                    const [, title, date = '', type = '', notes = ''] = columns;
                    if (!title || title.length > 500)
                        throw new Error('أضف عنوانًا حتى 500 حرف');
                    const task: StudyTask = { id: createClientId(), courseId: course.id, title, due: localDue(date), kind: kind(type), notes, done: false, url: '' };
                    if ([...state.tasks, ...out.tasks].some(t => t.courseId === task.courseId && fold(t.title) === fold(task.title) && t.kind === task.kind && t.due === task.due)) {
                        out.skipped++;
                        continue;
                    }
                    out.tasks.push(task);
                }
                else {
                    if (columns.length < 4 || columns.length > 5)
                        throw new Error('الأعمدة: الكورس | اليوم | من | إلى | القاعة');
                    const [, d, start, end, room = ''] = columns;
                    const lesson: Lesson = { id: createClientId(), courseId: course.id, day: day(d), start: clock(start), end: clock(end), room: text(room, 200) };
                    if (lesson.end <= lesson.start)
                        throw new Error('وقت النهاية يجب أن يكون بعد البداية');
                    if ([...state.lessons, ...out.lessons].some(l => l.courseId === lesson.courseId && l.day === lesson.day && l.start === lesson.start && l.end === lesson.end && l.room === lesson.room)) {
                        out.skipped++;
                        continue;
                    }
                    out.lessons.push(lesson);
                }
            }
        }
        catch (e) {
            out.errors.push(`السطر ${i + 1}: ${(e as Error).message}`);
        }
    }
    return out;
}
function details(raw: unknown): CourseDetails {
    const s = obj(raw);
    return { shortName: text(s.shortName, 200), description: text(s.description, 5000), teachers: array(s.teachers, 30).map(t => text(t, 200)), status: 'partial', warnings: [], sections: array(s.sections, 200).map(v => {
            const section = obj(v);
            return { id: id(section.id), title: text(section.title, 300), description: text(section.description, 5000), activities: array(section.activities, 2000).map(v => { const a = obj(v); return { id: id(a.id), title: text(a.title, 500), kind: id(a.kind), url: resourceUrl(a.url), description: text(a.description, 5000), completed: typeof a.completed === 'boolean' ? a.completed : null }; }) };
        }) };
}
export function parsePlanBackup(raw: unknown): PlanPreview {
    const wrapper = obj(raw), r = obj(wrapper.format === 'wilo-study-plan-v1' ? wrapper.state : wrapper);
    if (r.version !== 1)
        throw new Error('هذا ليس ملف نسخة احتياطية لمساحة الجامعة');
    const out = blank();
    out.courses = array(r.courses, 1000).map(v => { const c = obj(v); return { id: id(c.id), name: text(c.name, 300), url: resourceUrl(c.url), notes: text(c.notes), requires: array(c.requires, 1000).map(id), x: integer(c.x, 0, 10000), y: integer(c.y, 0, 10000), topics: c.topics === undefined ? [] : array(c.topics, 200).map(v => { const t = obj(v); return { id: id(t.id), title: text(t.title, 500), done: bool(t.done) }; }), ...(c.source ? { source: details(c.source) } : {}) }; });
    out.tasks = array(r.tasks, 5000).map(v => { const t = obj(v); const due = text(t.due, 40); if (due && !Number.isFinite(Date.parse(due)))
        throw new Error('موعد غير صالح'); return { id: id(t.id), courseId: id(t.courseId), title: text(t.title, 500), kind: kind(text(t.kind, 20)), due: due ? new Date(due).toISOString() : '', notes: text(t.notes), done: bool(t.done), url: resourceUrl(t.url), sourceDescription: text(t.sourceDescription || '', 5000) }; });
    out.lessons = array(r.lessons, 2000).map(v => { const l = obj(v); const start = clock(l.start), end = clock(l.end), d = integer(l.day, 0, 6); if (!Number.isInteger(d) || end <= start)
        throw new Error('محاضرة غير صالحة'); return { id: id(l.id), courseId: id(l.courseId), day: d, start, end, room: text(l.room, 200), sessionType: (['lecture','tutorial','lab'].includes(String(l.sessionType))?l.sessionType:'lecture') as Lesson['sessionType'] }; });
    for (const group of [out.courses, out.tasks, out.lessons])
        if (new Set(group.map(v => v.id)).size !== group.length)
            throw new Error('معرّفات مكررة في النسخة');
    const ids = new Set(out.courses.map(c => c.id));
    if ([...out.tasks, ...out.lessons].some(t => !ids.has(t.courseId)))
        throw new Error('مهمة أو محاضرة مرتبطة بكورس مفقود');
    for (const c of out.courses)
        validateCourse(c, out.courses);
    return out;
}
export function mergePlan(state: UniversityState, p: PlanPreview): UniversityState {
    if (p.errors.length)
        throw new Error('صحّح أخطاء الاستيراد أولًا');
    const courses = [...state.courses, ...p.courses.filter(c => !state.courses.some(old => old.id === c.id))];
    const tasks = [...state.tasks, ...p.tasks.filter(t => !state.tasks.some(old => old.id === t.id))];
    const lessons = [...state.lessons, ...p.lessons.filter(l => !state.lessons.some(old => old.id === l.id))];
    if (courses.length > 1000 || tasks.length > 5000 || lessons.length > 2000)
        throw new Error('تجاوزت مساحة الجامعة الحد المسموح للسجلات');
    for (const c of courses)
        validateCourse(c, courses);
    return { ...state, courses, tasks, lessons, importedAt: new Date().toISOString() };
}
export function planBackup(state: UniversityState) { return { format: 'wilo-study-plan-v1', exportedAt: new Date().toISOString(), state: { ...state, tasks: state.tasks.map(t => { const task = { ...t }; delete task.reminderProjectId; return task; }) } }; }
export function lessonConflicts(lessons: Lesson[]): Set<string> {
    const conflicts = new Set<string>();
    for (let i = 0; i < lessons.length; i++)
        for (let j = i + 1; j < lessons.length; j++) {
            const a = lessons[i], b = lessons[j];
            if (a.day === b.day && a.start < b.end && b.start < a.end) {
                conflicts.add(a.id);
                conflicts.add(b.id);
            }
        }
    return conflicts;
}

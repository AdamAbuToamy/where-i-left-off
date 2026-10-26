import { createClientId } from '../lib/clientId'
export type CourseActivity = {
    id: string;
    title: string;
    kind: string;
    url: string;
    description: string;
    completed: boolean | null;
};
export type CourseDetails = {
    shortName: string;
    description: string;
    teachers: string[];
    sections: {
        id: string;
        title: string;
        description: string;
        activities: CourseActivity[];
    }[];
    status: 'available' | 'partial' | 'unavailable';
    warnings: string[];
};
export type StudyTopic = {
    id: string;
    title: string;
    done: boolean;
};
export type Course = {
    id: string;
    name: string;
    url: string;
    notes: string;
    requires: string[];
    x: number;
    y: number;
    topics?: StudyTopic[];
    source?: CourseDetails;
};
export type StudyTask = {
    id: string;
    courseId: string;
    title: string;
    kind: 'assignment' | 'exam' | 'task';
    due: string;
    done: boolean;
    notes: string;
    url: string;
    sourceDescription?: string;
    reminderProjectId?: string;
};
export type Lesson = {
    notes?: string;
    sessionType?: 'lecture'|'tutorial'|'lab';
    id: string;
    courseId: string;
    day: number;
    start: string;
    end: string;
    room: string;
};
export type UniversityState = {
    version: 1;
    courses: Course[];
    tasks: StudyTask[];
    lessons: Lesson[];
    importedAt: string;
};
export const emptyUniversity = (): UniversityState => ({ version: 1, courses: [], tasks: [], lessons: [], importedAt: '' });
export function resourceUrl(value: unknown): string {
    if (value === '')
        return '';
    if (typeof value !== 'string' || value.length > 2000)
        throw new Error('رابط غير صالح');
    const u = new URL(value);
    if (u.protocol !== 'https:' || u.username || u.password || [...u.searchParams.keys()].some(k => /token|password|sesskey|secret|authorization/i.test(k)))
        throw new Error('استخدم رابط HTTPS عامًا دون كلمة مرور أو مفتاح');
    return u.href;
}
export function toLocalInput(isoDate: string): string {
    if (!isoDate)
        return '';
    const d = new Date(isoDate);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
export function validateCourse(course: Course, courses: Course[]) {
    if (!course.name.trim())
        throw new Error('أضف اسم الكورس');
    if (course.requires.some(id => id !== course.id && !courses.some(c => c.id === id)))
        throw new Error('متطلب غير موجود');
    const edges = new Map(courses.map(c => [c.id, c.id === course.id ? course.requires : c.requires]));
    edges.set(course.id, course.requires);
    const visited = new Set<string>();
    function visit(id: string, path: Set<string>) {
        if (path.has(id))
            throw new Error('المتطلبات تحتوي على حلقة');
        if (visited.has(id))
            return;
        const next = new Set(path).add(id);
        for (const dep of edges.get(id) || [])
            visit(dep, next);
        visited.add(id);
    }
    visit(course.id, new Set());
}
export function topicsFromText(value: string, previous: StudyTopic[] = []): StudyTopic[] {
    const lines = value.split('\n').map(s => s.trim()).filter(Boolean);
    if (lines.length > 200 || lines.some(s => s.length > 500))
        throw new Error('خطة الدراسة: حتى 200 موضوع، و500 حرف للموضوع');
    const used = new Set<string>();
    return lines.map(title => { const old = previous.find(t => t.title === title && !used.has(t.id)); if (old)
        used.add(old.id); return old || { id: createClientId(), title, done: false }; });
}

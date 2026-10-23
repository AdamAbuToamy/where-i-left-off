import { it, expect, vi } from 'vitest';
import { emptyUniversity, resourceUrl, topicsFromText, toLocalInput, UniversityStore, validateCourse } from '../src/university/model';
import { lessonConflicts, mergePlan, parsePlanBackup, parsePlanText, planBackup } from '../src/university/planImport';
function initial() { return mergePlan(emptyUniversity(), parsePlanText('Algorithms\nDatabases', 'courses', emptyUniversity())); }
it('imports spreadsheet rows only after validation, skips duplicates and resolves the named course', () => {
    const state = initial();
    state.courses[0].notes = 'My notes';
    const repeated = parsePlanText('Algorithms\nAlgorithms\nNetworks', 'courses', state);
    expect(repeated.courses.map(c => c.name)).toEqual(['Networks']);
    expect(repeated.skipped).toBe(2);
    const tasks = parsePlanText('Algorithms\tExercise 1\t2026-11-02 14:30\tassignment\tInduction\nUnknown | Bad | 2026-11-02 | task', 'tasks', state);
    expect(tasks.tasks[0]).toMatchObject({ courseId: state.courses[0].id, title: 'Exercise 1', kind: 'assignment', notes: 'Induction', done: false });
    expect(new Date(tasks.tasks[0].due).getHours()).toBe(14);
    expect(tasks.errors[0]).toContain('السطر 2');
    expect(() => mergePlan(state, tasks)).toThrow();
    expect(state.tasks).toHaveLength(0);
    const valid = parsePlanText('Algorithms | Exercise 1 | 2026-11-02 14:30 | assignment | Induction', 'tasks', state);
    const next = mergePlan(state, valid);
    expect(next.courses[0].notes).toBe('My notes');
    expect(parsePlanText('Algorithms | Exercise 1 | 2026-11-02 14:30 | assignment', 'tasks', next).skipped).toBe(1);
});
it('rejects impossible dates, malformed clocks, oversized batches and unsafe links', () => {
    const state = initial();
    for (const date of ['2026-02-30 10:00', '2026-11-02 25:00', 'yesterday'])
        expect(parsePlanText(`Algorithms | Task | ${date} | task`, 'tasks', state).errors).toHaveLength(1);
    expect(parsePlanText('Algorithms | الأحد | 11:00 | 10:00', 'lessons', state).errors).toHaveLength(1);
    expect(parsePlanText('x\n'.repeat(501), 'courses', state).errors).toHaveLength(1);
    for (const url of ['javascript:alert(1)', 'https://user:password@example.test', 'https://example.test/?token=private'])
        expect(() => resourceUrl(url)).toThrow();
    expect(resourceUrl('https://example.test/lecture.pdf')).toContain('lecture.pdf');
});
it('imports Arabic and Hebrew lessons, detects overlaps and accepts adjacent intervals', () => {
    const state = initial(), preview = parsePlanText('Algorithms | الأحد | 09:00 | 11:00 | A\nDatabases | ראשון | 10:00 | 12:00 | B\nDatabases | الأحد | 12:00 | 13:00 | B', 'lessons', state);
    expect(preview.errors).toEqual([]);
    expect(preview.lessons[0].day).toBe(0);
    expect([...lessonConflicts(preview.lessons)]).toEqual(preview.lessons.slice(0, 2).map(l => l.id));
    expect(parsePlanText('Algorithms | الأحد | 09:00 | 11:00 | A', 'lessons', mergePlan(state, preview)).skipped).toBe(1);
});
it('restores complete backups without duplicating records, overwriting notes or trusting foreign reminder links', () => {
    const state = initial();
    state.courses[0].topics = topicsFromText('Proofs');
    state.courses[0].topics[0].done = true;
    const task = parsePlanText('Algorithms | Exam | 2026-11-10 | exam', 'tasks', state);
    state.tasks = task.tasks;
    state.tasks[0].reminderProjectId = 'a'.repeat(20);
    const backup = planBackup(state);
    expect(JSON.stringify(backup)).not.toContain('reminderProjectId');
    // Even a crafted older flat backup cannot activate a foreign account's reminder.
    const parsed = parsePlanBackup({ ...state, tasks: [{ ...state.tasks[0], password: 'SECRET' }] });
    expect(JSON.stringify(parsed)).not.toMatch(/SECRET|reminderProjectId/);
    const restored = mergePlan(emptyUniversity(), parsePlanBackup(backup));
    expect(restored.courses[0].topics?.[0].done).toBe(true);
    restored.courses[0].notes = 'My edit';
    restored.tasks[0].done = true;
    const again = mergePlan(restored, parsePlanBackup(backup));
    expect(again.courses).toHaveLength(2);
    expect(again.tasks).toHaveLength(1);
    expect(again.courses[0].notes).toBe('My edit');
    expect(again.tasks[0].done).toBe(true);
});
it('rejects backup references, cycles and duplicate identities before saving', () => {
    const state = initial();
    state.courses[0].requires = [state.courses[1].id];
    state.courses[1].requires = [state.courses[0].id];
    expect(() => parsePlanBackup(state)).toThrow('حلقة');
    expect(() => validateCourse({ ...state.courses[0], requires: ['missing'] }, state.courses)).toThrow('موجود');
    state.courses[0].requires = [];
    state.courses[1].requires = [];
    expect(() => parsePlanBackup({ ...state, courses: [state.courses[0], state.courses[0]] })).toThrow('مكررة');
    const bad = mergePlan(state, parsePlanText('Algorithms | Test | | task', 'tasks', state));
    bad.tasks[0].courseId = 'missing';
    expect(() => parsePlanBackup(bad)).toThrow('مفقود');
});
it('retains completed checklist entries by identity when other syllabus lines are edited or reordered', () => {
    const topics = topicsFromText('Proofs\nGraphs');
    topics[0].done = true;
    const next = topicsFromText('Graphs\nProofs\nDynamic programming', topics);
    expect(next[1]).toEqual(topics[0]);
    expect(next[2].done).toBe(false);
});
it('keeps old local course records and isolates both accounts and Firebase projects', () => {
    const data = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => data.get(k) || null, setItem: (k: string, v: string) => data.set(k, v) });
    try {
        const a = new UniversityStore('alice', 'production'), state = initial();
        state.courses[0].id = 'moodle-42';
        a.save(state);
        expect(a.load().courses[0].id).toBe('moodle-42');
        expect(new UniversityStore('bob', 'production').load().courses).toHaveLength(0);
        expect(new UniversityStore('alice', 'emulator').load().courses).toHaveLength(0);
    }
    finally {
        vi.unstubAllGlobals();
    }
});
it('formats reminder dates using the actual local clock', () => { const d = new Date('2026-10-22T10:00:00Z'); expect(toLocalInput(d.toISOString()).slice(11, 13)).toBe(String(d.getHours()).padStart(2, '0')); });

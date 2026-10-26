import { StudyLocaleProvider } from "../src/university/StudyLocale";
// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import type { User } from "firebase/auth";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const reminder = vi.hoisted(() => ({ sync: vi.fn(), prepare: vi.fn() }));
vi.mock("../src/lib/firebase", () => ({
    db: { app: { options: { projectId: "demo" } } },
}));
vi.mock("../src/university/useStudySync",()=>({useStudySync:(store:{save:(s:unknown)=>void})=>({status:{ready:true,pending:0,conflicts:[],error:''},commit:(state:unknown)=>store.save(state),resolve:vi.fn(),retry:vi.fn()})}));
vi.mock("../src/university/reminders", () => ({
    syncReminder: reminder.sync,
    prepareReminder: reminder.prepare,
}));
import CourseNavigator from '../src/university/CourseNavigator';
import UniversityPage from "../src/university/UniversityPage";
import { ADMIN_EMAIL } from "../src/lib/admin";
const user = {
    uid: "pilot",
    email: ADMIN_EMAIL,
    emailVerified: true,
} as User;
let root: Root, container: HTMLDivElement;
async function render(u = user,language:'ar'|'en'|'he'='ar') {
    await act(async () => root.render(<StudyLocaleProvider value={language}><UniversityPage user={u}/></StudyLocaleProvider>));
}
async function click(title: string) {
    const button = [...container.querySelectorAll("button")].find((b) => b.textContent === title);
    expect(button).toBeTruthy();
    await act(async () => button!.click());
}
async function submit(values: Record<string, string>) {
    const form = container.querySelector("dialog form")!;
    for (const [name, value] of Object.entries(values))
        (form.querySelector(`[name="${name}"]`) as HTMLInputElement).value = value;
    await act(async () => form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
}
beforeEach(async () => {
    localStorage.clear();
    vi.stubGlobal('crypto',{getRandomValues:globalThis.crypto.getRandomValues.bind(globalThis.crypto)});
    reminder.sync.mockReset();
    reminder.prepare.mockReset();
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    HTMLDialogElement.prototype.showModal = function () {
        this.setAttribute("open", "");
    };
    HTMLDialogElement.prototype.close = function () {
        this.removeAttribute("open");
    };
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    await render();
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});
it("creates and edits real course and task records, persists them, and never enables reminders implicitly", async () => {
    await click("إضافة كورس");
    await submit({ name: "Algorithms", notes: "Practice every Sunday", url: "" });
    expect(container.textContent).toContain("Algorithms");
    expect(container.textContent).toContain("Practice every Sunday");
    await click("إضافة مهمة");
    await submit({
        title: "Exercise 1",
        due: "2026-11-10T14:30",
        notes: "Proof by induction",
        url: "",
    });
    expect(container.textContent).toContain("Exercise 1");
    const check = container.querySelector(".study-task input[type=checkbox]") as HTMLInputElement;
    await act(async () => check.click());
    expect(container.querySelector(".study-task.is-done")).not.toBeNull();
    expect(reminder.sync).not.toHaveBeenCalled();
    await act(async () => root.unmount());
    root = createRoot(container);
    await render();
    expect(container.textContent).toContain("Algorithms");
    expect(container.textContent).toContain("Proof by induction");
    expect(container.querySelector(".study-task.is-done")).not.toBeNull();
});
it("allows verified students with isolated data and rejects unverified accounts", async () => {
    await render({ ...user, uid: 'other', email: 'student@example.test' } as User);
    expect(container.querySelector('.study-page')).not.toBeNull();
    expect(container.textContent).not.toContain('Algorithms');
    await render({ ...user, emailVerified: false } as User);
    expect(container.querySelector('.study-page')).toBeNull();
});
it("stores weekly lessons with their course and rejects reversed times", async () => {
    await click("إضافة كورس");
    await submit({ name: "Databases", notes: "", url: "" });
    await click("الجدول الأسبوعي");
    await click("إضافة محاضرة");
    await submit({ start: "11:00", end: "10:00", room: "Building 90" });
    expect(container.textContent).toContain("وقت النهاية يجب أن يكون بعد البداية");
    await submit({ start: "09:00", end: "10:00", room: "Building 90" });
    expect(container.querySelector(".study-lesson")?.textContent).toContain("Building 90");
});
it('saves syllabus progress across edits and reload without showing a connection flow', async () => {
    expect(container.textContent).not.toContain('Moodle');
    await click('إضافة كورس');
    await submit({ name: 'Algorithms', notes: '', url: '', topics: 'Proofs\nGraphs' });
    const checkbox = container.querySelector('.study-topic-list input') as HTMLInputElement;
    await act(async () => checkbox.click());
    await click('تعديل الكورس');
    await submit({ name: 'Algorithms', notes: 'Updated', url: '', topics: 'Proofs\nGraphs\nTrees' });
    await act(async () => root.unmount());
    root = createRoot(container);
    await render();
    expect((container.querySelector('.study-topic-list input') as HTMLInputElement).checked).toBe(true);
    expect(container.querySelectorAll('.study-topic-list input')).toHaveLength(3);
});
it('previews a pasted course batch and persists only when explicitly confirmed', async () => {
    await click('إضافة دفعة');
    const textarea = container.querySelector('.study-plan-import textarea') as HTMLTextAreaElement;
    await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, 'Calculus\nPhysics');
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(container.textContent).toContain('2 سجل جديد');
    expect(localStorage.getItem('wilo-university-v1/demo/pilot')).toBeNull();
    await click('إضافة الدفعة');
    const saved = JSON.parse(localStorage.getItem('wilo-university-v1/demo/pilot')!);
    expect(saved.courses.map((c: {
        name: string;
    }) => c.name)).toEqual(['Calculus', 'Physics']);
    expect(container.querySelector('dialog')).toBeNull();
    expect(reminder.sync).not.toHaveBeenCalled();
});
it('requires confirmation for an extension capture and cancellation leaves the plan untouched',async()=>{
 const capture={version:1,kind:'assignment',courseName:'Algorithms',courseUrl:'https://campus.example.edu/course/view.php?id=42',title:'Exercise',url:'https://campus.example.edu/mod/assign/view.php?id=9'};
 await act(async()=>root.unmount());
 history.replaceState(null,'','/#/university?studyCapture='+encodeURIComponent(JSON.stringify(capture)));
 root=createRoot(container);await render();
 expect(container.querySelector('.study-capture-review')).not.toBeNull();expect(location.hash).toBe('#/university');
 expect(localStorage.getItem('wilo-university-v1/demo/pilot')).toBeNull();
 await click('إلغاء');expect(container.querySelector('dialog')).toBeNull();expect(localStorage.getItem('wilo-university-v1/demo/pilot')).toBeNull();
 await act(async()=>root.unmount());history.replaceState(null,'','/#/university?studyCapture='+encodeURIComponent(JSON.stringify(capture)));root=createRoot(container);await render();
 await submit({courseName:'Algorithms',title:'Exercise',due:''});
 const saved=JSON.parse(localStorage.getItem('wilo-university-v1/demo/pilot')!);expect(saved.courses).toHaveLength(1);expect(saved.tasks).toHaveLength(1);expect(reminder.sync).not.toHaveBeenCalled();
});
it('localizes University and the full timetable editor without translating user course names',async()=>{
 await click('إضافة كورس');await submit({name:'وظيفة',notes:'',url:''});
 await render(user,'en');expect(container.textContent).toContain('Semester plan');expect(container.textContent).toContain('وظيفة');
 await click('Weekly timetable');await click('Build weekly timetable');
 expect(container.querySelector('dialog')?.textContent).toContain('Session type');expect(container.querySelector('dialog')?.textContent).toContain('Tutorial / exercise');expect(container.querySelector('dialog')?.textContent).toContain('Sunday');
 const room=container.querySelector('.study-week-row input[placeholder]') as HTMLInputElement;expect(room.placeholder).toBe('Example: building 90, room 204');
 await act(async()=>(container.querySelector('[aria-label="Close"]') as HTMLButtonElement).click());await render(user,'he');expect(container.textContent).toContain('תוכנית הסמסטר');expect(container.textContent).toContain('בניית מערכת שעות');
});
it('builds lectures and tutorials on several days and displays their rooms',async()=>{
 await click('إضافة كورس');await submit({name:'Algorithms',notes:'',url:''});await click('الجدول الأسبوعي');await click('بناء جدول الأسبوع');
 const form=container.querySelector('dialog form')!;const selects=form.querySelectorAll('select');
 await act(async()=>{const select=selects[1] as HTMLSelectElement;select.value='tutorial';select.dispatchEvent(new Event('change',{bubbles:true}));});
 const days=form.querySelectorAll('.study-week-days input');await act(async()=>(days[2] as HTMLInputElement).click());
 const room=form.querySelector('input[placeholder]') as HTMLInputElement;room.value='90 / 204';
 await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(room,'90 / 204');room.dispatchEvent(new Event('input',{bubbles:true}));});
 await act(async()=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
 const lessons=JSON.parse(localStorage.getItem('wilo-university-v1/demo/pilot')!).lessons;expect(lessons).toHaveLength(2);expect(lessons.every((l:{sessionType:string})=>l.sessionType==='tutorial')).toBe(true);
 expect(container.querySelectorAll('.study-lesson')).toHaveLength(2);
});
it('shows no Arabic interface text on an empty English or Hebrew University page',async()=>{
 for(const language of ['en','he'] as const){await render(user,language);expect(container.querySelector('.study-page')?.getAttribute('dir')).toBe(language==='en'?'ltr':'rtl');expect(container.textContent).not.toMatch(/[\u0600-\u06ff]/);}
});

it('paginates courses, finds the last course and marks its open details without translating notes', async () => {
    const courses = Array.from({length:14}, (_,i) => ({id:`course-${i}`, name:`Course ${i + 1}`, notes:`Notes ${i + 1} https://example.test/course/${i + 1}`, url:'', requires:[], x:0, y:0}));
    localStorage.setItem('wilo-university-v1/demo/pilot',JSON.stringify({version:1,courses,tasks:[],lessons:[],importedAt:""}));
    await act(async () => root.unmount());root=createRoot(container);await render();
    expect(container.querySelectorAll('.study-course-choice')).toHaveLength(6);
    await click('التالي');expect(container.querySelector('.study-course-pages')?.textContent).toContain('2 / 3');
    await click('التالي');expect(container.querySelectorAll('.study-course-choice')).toHaveLength(2);
    const search=container.querySelector('input[type=search]') as HTMLInputElement;
    await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(search,'Course 14');search.dispatchEvent(new Event('input',{bubbles:true}));});
    expect(container.querySelectorAll('.study-course-choice')).toHaveLength(1);
    await act(async()=>(container.querySelector('.study-course-choice') as HTMLButtonElement).click());
    expect(container.querySelector('.study-course-choice[aria-pressed=true]')?.textContent).toContain('Course 14');
    expect(container.querySelector('.study-current-course')?.textContent).toBe('الكورس المفتوح');
    expect(container.querySelector('[data-study-course="course-13"]')).not.toBeNull();
    expect(container.querySelector('.study-course-notes a')?.getAttribute('href')).toBe('https://example.test/course/14');
    await render(user,'en');expect(container.querySelector('.study-current-course')?.textContent).toBe('Current course');
    expect(container.querySelector('.study-course-pages')?.textContent).toContain('Previous');
    await click('All courses');expect(container.querySelectorAll('.study-course-choice[aria-pressed=true]')).toHaveLength(0);
    expect(container.querySelector('[data-study-course]')).toBeNull();
});
it('labels the next deadline with its course and supports dismissing and expiring reminder notices', async () => {
    await click('إضافة كورس');await submit({name:'Networks',notes:'',url:''});
    await click('إضافة مهمة');await submit({title:'Lab report',due:'2099-11-10T14:30',notes:'',url:''});
    expect(container.querySelector('.study-next-course')?.textContent).toBe('Networks');
    reminder.prepare.mockImplementation(t=>t);
    // Adapter is injected here: no production account or push settings are changed.
    reminder.sync.mockImplementation(async (_uid,t)=>({...t,reminderProjectId:'linked'}));
    await click('تذكير على الهاتف');expect(container.querySelector('.study-notice')).not.toBeNull();
    await act(async()=>(container.querySelector('[aria-label="إغلاق الرسالة"]') as HTMLButtonElement).click());
    expect(container.querySelector('.study-notice')).toBeNull();
    vi.useFakeTimers();
    try {await click('تحديث التذكير');expect(container.querySelector('.study-notice')).not.toBeNull();await act(async()=>vi.advanceTimersByTime(10000));expect(container.querySelector('.study-notice')).toBeNull();}
    finally {vi.useRealTimers();}
    expect(container.querySelector('.study-task')?.textContent).toContain('Lab report');
});

it('keeps the current course on its page when a cloud snapshot reorders courses',async()=>{
    const courses=Array.from({length:14},(_,i)=>({id:`stable-${i}`,name:`Course ${i+1}`,notes:'',url:'',requires:[],x:0,y:0}));
    const props={tasks:[],selectedId:'stable-13',filter:'stable-13',onSelect:vi.fn(),courseColor:()=> '#385c4b',onAdd:vi.fn()};
    await act(async()=>root.render(<CourseNavigator courses={courses} {...props}/>));
    expect(container.querySelector('.study-course-choice[aria-pressed=true]')?.textContent).toContain('Course 14');
    await act(async()=>root.render(<CourseNavigator courses={[...courses].reverse()} {...props}/>));
    expect(container.querySelector('.study-course-choice[aria-pressed=true]')?.textContent).toContain('Course 14');
    expect(container.querySelectorAll('.study-course-choice')).toHaveLength(2);
});

import {lazy,Suspense} from 'react';
import {GitBranch,GraduationCap,CalendarDays,ChevronDown} from 'lucide-react';
import {trialCourseColor} from './trialSelectors';
import './university-trial.css';
const UniversityTrial=lazy(()=>import('./UniversityTrial'));
const UniversityTrialSchedule=lazy(()=>import('./UniversityTrialSchedule'));
import LinkedText from '../components/LinkedText'
import { studyView } from '../lib/navigation'
import { createClientId } from '../lib/clientId'
import { translateStudyText, useStudyLanguage } from "./studyLocaleContext";
import StudyLocalized from "./StudyLocale";
import WeeklyScheduleEditor from "./WeeklyScheduleEditor";
import { sessionNames } from "./studyTools";
import { courseTemplate, restoreStudyItem } from "./studyTools";
import type { DeletedStudyItem } from "./studyTools";
import { useStudySync } from "./useStudySync";
import StudyCaptureReview from "./StudyCaptureReview";
import { parseStudyCapture, acceptStudyCapture, captureMatches } from "./studyCapture";
import PlanImport from "./PlanImport";
import { lessonConflicts, mergePlan, parsePlanBackup, planBackup } from "./planImport";
import type { PlanPreview } from "./planImport";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { User } from "firebase/auth";
import { db } from "../lib/firebase";
import { UniversityStore, emptyUniversity, resourceUrl, topicsFromText, toLocalInput, validateCourse, } from "./model";
import type { Course, Lesson, StudyTask, UniversityState, } from "./model";
import { prepareReminder, syncReminder } from "./reminders";
import "./university.css";
const days = [
    "الأحد",
    "الاثنين",
    "الثلاثاء",
    "الأربعاء",
    "الخميس",
    "الجمعة",
    "السبت",
];
const kinds = { assignment: "وظيفة", exam: "امتحان / اختبار", task: "مهمة" };
const key = () => createClientId();
function download(name: string, data: unknown) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Modal({ title, children, close, }: {
    title: string;
    children: ReactNode;
    close: () => void;
}) {
    const ref = useRef<HTMLDialogElement>(null);
    useEffect(() => {
        const d = ref.current!;
        d.showModal();
        return () => d.close();
    }, []);
    return <StudyLocalized>{(<dialog className="study-dialog" ref={ref} onCancel={(e) => {
            e.preventDefault();
            close();
        }}>
      <header>
        <h2>{title}</h2>
        <button type="button" aria-label="إغلاق" onClick={close}>
          ×
        </button>
      </header>
      {children}
    </dialog>)}</StudyLocalized>;
}
function setUniversityLocation(nextTab: "overview"|"schedule"|"map", courseId: string) {
  const params=new URLSearchParams(location.hash.split('?')[1]);
  params.delete('preview');params.set('tab',nextTab);
  if(courseId)params.set('courseId',courseId);else params.delete('courseId');
  location.hash='/university?'+params.toString();
}
function Workspace({ user }: {
    user: User;
}) {
    const language=useStudyLanguage();
    const [capture, setCapture] = useState(() => parseStudyCapture(location.hash));
    useEffect(() => {
        if (capture) history.replaceState(history.state, "", location.pathname + location.search + "#/university");
    }, [capture]);
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 30000);
        return () => clearInterval(timer);
    }, []);
    const [store] = useState(() => new UniversityStore(user.uid, db!.app.options.projectId || "local"));
    const [initial] = useState(() => {
        try {
            return { state: store.load(), error: "" };
        }
        catch (e) {
            return { state: emptyUniversity(), error: (e as Error).message };
        }
    });
    const [state, setState] = useState(initial.state), [error, setError] = useState(initial.error), [message, setMessage] = useState(""), [busy, setBusy] = useState(false);
    useEffect(() => {
        if (!message) return;
        const timer = window.setTimeout(() => setMessage(""), 10000);
        return () => window.clearTimeout(timer);
    }, [message]);
    const [scheduleEdit,setScheduleEdit]=useState<UniversityState|null>(null);
    const [undo,setUndo] = useState<DeletedStudyItem|null>(null);
    const [tab, setTab] = useState<"overview" | "schedule" | "map">(()=>studyView().tab), [filter, setFilter] = useState(()=>studyView().courseId), [preview, setPreview] = useState<PlanPreview | null>(null), [batchOpen, setBatchOpen] = useState(false);
    useEffect(()=>{const changed=()=>{const next=studyView();setTab(next.tab);setFilter(next.courseId)};window.addEventListener('hashchange',changed);return()=>window.removeEventListener('hashchange',changed)},[]);
    const [editing, setEditing] = useState<{
        kind: "course";
        value: Course;
    } | {
        kind: "task";
        value: StudyTask;
    } | {
        kind: "lesson";
        value: Lesson;
    } | null>(null);
    const drag = useRef<{
        id: string;
        x: number;
        y: number;
        startX: number;
        startY: number;
        pointX: number;
        pointY: number;
    } | null>(null), map = useRef<HTMLDivElement>(null), latest = useRef(state);
    const cloud = useStudySync(store,user.uid,next=>{latest.current=next;setState(next);});
    const openedLink=useRef("");
    useEffect(()=>{
      const params=new URLSearchParams(location.hash.split('?')[1]||'');
      const taskId=params.get('task'),lessonId=params.get('lesson'),id=taskId||lessonId;
      if(!id||openedLink.current===id)return;
      const item=taskId?state.tasks.find(t=>t.id===id):state.lessons.find(l=>l.id===id);
      if(item){openedLink.current=id;queueMicrotask(()=>{setTab(taskId?'overview':'schedule');setFilter(item.courseId);setEditing(taskId?{kind:'task',value:item as StudyTask}:{kind:'lesson',value:item as Lesson});});}
    },[state]);
    useEffect(()=>{
      const receive=()=>{try{
        const raw=sessionStorage.getItem('wilo-ai-plan');if(!raw)return;
        const data=JSON.parse(raw);if(data.uid!==user.uid||Date.now()-data.createdAt>600000){sessionStorage.removeItem('wilo-ai-plan');return;}
        const draft=data.preview;
        if(!draft||!Array.isArray(draft.tasks)||draft.tasks.length>8)throw new Error('مقترح غير صالح');
        if(draft.tasks.some((t:StudyTask)=>!latest.current.courses.some(c=>c.id===t.courseId))){if(!cloud.status.ready)return;throw new Error('مقترح غير صالح');}
        const parsed=parsePlanBackup({...latest.current,tasks:[...latest.current.tasks,...draft.tasks],lessons:latest.current.lessons});
        const fresh=parsed.tasks.filter(t=>draft.tasks.some((d:StudyTask)=>d.id===t.id));
        sessionStorage.removeItem('wilo-ai-plan');setPreview({courses:[],tasks:fresh,lessons:[],errors:[],skipped:0});
      }catch{setError('تعذرت قراءة المقترح؛ أعد طلبه بعد فتح كورساتك.');}};
      receive();window.addEventListener('study-ai-proposal',receive);return()=>window.removeEventListener('study-ai-proposal',receive);
    },[user.uid,cloud.status.ready,state.courses]);
    function commit(next: UniversityState) {
        if (initial.error)
            throw new Error(initial.error);
        cloud.commit(next);
        latest.current = next;
        setState(next);
    }
    async function run(action: () => Promise<void> | void) {
        setBusy(true);
        setError("");
        setMessage("");
        try {
            await action();
        }
        catch (e) {
            setError((e as Error).message || "تعذّر الحفظ");
        }
        finally {
            setBusy(false);
        }
    }
    const selectedCourse = state.courses.find(c => c.id === filter) || (state.courses.length === 1 ? state.courses[0] : undefined);
    const courseName = (id: string) => state.courses.find((c) => c.id === id)?.name || "بدون كورس";
    const courseColor = trialCourseColor;
    const pending = state.tasks.filter((t) => !t.done && (!filter || t.courseId === filter));
    const next = pending
        .filter((t) => t.due && Date.parse(t.due) > now)
        .sort((a, b) => Date.parse(a.due) - Date.parse(b.due))[0];
    const summaryDate = (date: string) => date
        ? new Intl.DateTimeFormat(language, {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }).format(new Date(date))
        : "بدون موعد";
    function newCourse() {
        setEditing({
            kind: "course",
            value: {
                id: key(),
                name: "",
                url: "",
                notes: "",
                requires: [],
                x: 40 + (state.courses.length % 3) * 270,
                y: Math.min(10000, 40 + Math.floor(state.courses.length / 3) * 160),
            },
        });
    }
    function newTask() {
        if (!state.courses.length) {
            setError("أضف كورسًا أولًا");
            return;
        }
        setEditing({
            kind: "task",
            value: {
                id: key(),
                courseId: filter || state.courses[0].id,
                title: "",
                kind: "assignment",
                due: "",
                done: false,
                notes: "",
                url: "",
            },
        });
    }
    function newLesson() {
        if (!state.courses.length) {
            setError("أضف كورسًا أولًا");
            return;
        }
        setEditing({
            kind: "lesson",
            value: {
                id: key(),
                courseId: filter || state.courses[0].id,
                day: 0,
                start: "09:00",
                end: "10:00",
                room: "",
            },
        });
    }
    async function saveTask(task: StudyTask) {
        const linked = task.reminderProjectId
            ? await syncReminder(user.uid, task)
            : task;
        commit({
            ...latest.current,
            tasks: [
                ...latest.current.tasks.filter((t) => t.id !== linked.id),
                linked,
            ],
        });
    }
    const conflicts = lessonConflicts(state.lessons);
    async function importPlan(preview: PlanPreview) {
        await run(() => {
            commit(mergePlan(latest.current, preview));
            setPreview(null);
            setBatchOpen(false);
            setMessage("تمت إضافة الخطة مع الاحتفاظ ببياناتك السابقة. اختر تذكير الهاتف لكل مهمة تريدها.");
        });
    }
    function updateUniversityRoute(nextTab: "overview"|"schedule"|"map", courseId: string) {
      setTab(nextTab);setFilter(courseId);setUniversityLocation(nextTab,courseId);
    }
    function renderTasks(tasks: StudyTask[]) {return <>{tasks.map((t) => (<article data-study-task={t.id} key={t.id} className={`study-task ${t.done ? "is-done" : ""}`}>
                  <div className="study-task-top">
                    <label>
                      <input type="checkbox" checked={t.done} disabled={busy} onChange={(e) => void run(() => saveTask({ ...t, done: e.target.checked }))}/>
                      <span className="study-tag">{kinds[t.kind]}</span>
                    </label>
                    <small dir="auto" style={{ color: courseColor(t.courseId) }}>
                      {courseName(t.courseId)}
                    </small>
                  </div>
                  <h4 dir="auto">{t.title}</h4>
                  <p className={!t.done && t.due && Date.parse(t.due) < now
                    ? "study-overdue"
                    : ""}>
                    {summaryDate(t.due)}
                  </p>
                  {t.sourceDescription && (<details className="study-task-source">
                      <summary>تفاصيل محفوظة للمهمة</summary>
                      <p dir="auto">{t.sourceDescription}</p>
                    </details>)}
                  {t.notes && (<p className="study-task-notes" dir="auto">
                      <LinkedText text={t.notes}/>
                    </p>)}
                  <footer>
                    <button disabled={busy} onClick={() => setEditing({ kind: "task", value: t })}>
                      تعديل
                    </button>
                    {t.url && (<a href={t.url} target="_blank" rel="noopener">
                        فتح الرابط
                      </a>)}
                    <button disabled={busy || t.done || !t.due} onClick={() => void run(async () => {
                    const prepared = prepareReminder(t);
                    commit({
                        ...latest.current,
                        tasks: latest.current.tasks.map((x) => x.id === t.id ? prepared : x),
                    });
                    const linked = await syncReminder(user.uid, prepared, true);
                    commit({
                        ...latest.current,
                        tasks: latest.current.tasks.map((x) => x.id === t.id ? linked : x),
                    });
                    setMessage("تم ربط الموعد ببطاقة في مهامك. يستخدم إعدادات التذكير وساعات الهدوء الحالية.");
                })}>
                      {t.reminderProjectId
                    ? "تحديث التذكير"
                    : "تذكير على الهاتف"}
                    </button>
                  </footer>
                </article>))}</>}
    return <StudyLocalized>{(<section className="study-page study-university-trial" dir="rtl" aria-label="صفحة الجامعة">
      <fieldset className="study-controls" disabled={busy}>
        <header className="study-hero">
          <div>
            <span className="study-eyebrow">مساحتي الدراسية</span>
            <h2>خطة الفصل</h2>
            <p>من أول محاضرة إلى آخر امتحان؛ خطتك بين يديك.</p>
          </div>
          <div className="study-hero-actions"><details className="study-trial-tools"><summary><ChevronDown size={16}/>أدوات الخطة</summary><div>
            <button className="primary-button" onClick={() => setBatchOpen(true)}>إضافة دفعة</button>
            <label className="study-upload secondary-button">
              استعادة نسخة احتياطية
              <input type="file" accept=".json,application/json" disabled={busy} onChange={e => {
            const file = e.target.files?.[0];
            if (file)
                void run(async () => {
                    if (file.size > 4000000)
                        throw new Error("حجم الملف أكبر من المسموح");
                    setPreview(parsePlanBackup(JSON.parse(await file.text())));
                });
            e.target.value = "";
        }}/>
            </label>
          </div></details></div>
        </header>
        <div className="study-storage" role="status">
          {cloud.status.error || (!cloud.status.ready ? "خطتك محفوظة محليًا؛ جارٍ الاتصال بالمزامنة…" : cloud.status.pending ? `محفوظة على الجهاز · ${cloud.status.pending} تغييرات تنتظر المزامنة` : "تمت المزامنة مع حسابك · متاحة على أجهزتك")}
          {!!cloud.status.error&&<button onClick={cloud.retry}>إعادة المزامنة</button>}
        </div>
        {cloud.status.conflicts.map(key=><section className="study-sync-conflict" key={key}><p>عُدّل السجل نفسه على جهاز آخر. اختر النسخة التي تريد الاحتفاظ بها؛ لم نستبدل تعديلك تلقائيًا.</p><strong dir="auto">{key.startsWith('courses_')?state.courses.find(c=>c.id===key.slice(8))?.name:key.startsWith('tasks_')?state.tasks.find(t=>t.id===key.slice(6))?.title:state.lessons.find(l=>l.id===key.slice(8))?.room}</strong><button onClick={()=>cloud.resolve(key,'local')}>الاحتفاظ بتعديلي</button><button onClick={()=>cloud.resolve(key,'cloud')}>استخدام نسخة الحساب</button></section>)}
        <div className="study-stats">
          <article>
            <span>كورسات الفصل</span>
            <strong>{state.courses.length.toString().padStart(2, "0")}</strong>
          </article>
          <article>
            <span>مهام مفتوحة</span>
            <strong>{pending.length.toString().padStart(2, "0")}</strong>
          </article>
          <article>
            <span>الموعد القادم</span>
            <strong className="study-next" dir="auto">
              {next?next.title:<span data-study-ui="true">لا توجد مواعيد قادمة</span>}
            </strong>
            {next && <small className="study-next-course" dir="auto">{courseName(next.courseId)}</small>}
            <small>
              {next
            ? summaryDate(next.due)
            : "أضف موعد تسليم أو امتحان"}
            </small>
          </article>
        </div>
        {error && (<p className="study-error" role="alert">
            {error}
          </p>)}
        {message && (<div className="study-success study-notice">
            <span role="status">{message}</span>
            <button type="button" aria-label="إغلاق الرسالة" onClick={() => setMessage("")}>×</button>
          </div>)}
        <nav className="study-tabs" aria-label="عرض مساحة الجامعة">
          {([
            ["overview", "الكورسات والمهام"],
            ["schedule", "الجدول الأسبوعي"],
            ["map", "خريطة الكورسات"],
        ] as const).map(([id, title]) => (<button key={id} aria-pressed={tab === id} onClick={() => updateUniversityRoute(id,filter)}>
              {id==='map'?<GitBranch size={17}/>:id==='schedule'?<CalendarDays size={17}/>:<GraduationCap size={17}/>}{title}{id==='map'&&<small>UML</small>}
            </button>))}
        </nav>
        <div className="study-toolbar">
          {(tab!=='overview')&&<label>
            الكورس
            <select value={filter} onChange={(e) => updateUniversityRoute(tab,e.target.value)}>
              <option value="">كل الكورسات</option>
              {state.courses.map((c) => (<option key={c.id} value={c.id}>
                  {c.name}
                </option>))}
            </select>
          </label>}
          <div>
            {tab==='schedule'&&<button className="secondary-button" disabled={!state.courses.length} onClick={()=>setScheduleEdit(latest.current)}>بناء جدول الأسبوع</button>}
            <button className="secondary-button" onClick={newCourse}>
              إضافة كورس
            </button>
            <button className="primary-button" onClick={tab === "schedule" ? newLesson : newTask}>
              {tab === "schedule" ? "إضافة محاضرة" : "إضافة مهمة"}
            </button>
          </div>
        </div>
        {tab==='overview'&&<Suspense fallback={<p role="status">…</p>}><UniversityTrial state={state} selected={selectedCourse} filter={filter} now={now} busy={busy} language={language} courseColor={courseColor} select={id=>updateUniversityRoute('overview',id)} addCourse={()=>setBatchOpen(true)} addTask={newTask} editCourse={course=>setEditing({kind:'course',value:course})} template={course=>setEditing({kind:'course',value:courseTemplate(course,state.courses.length,translateStudyText('— فصل جديد',language))})} toggleTopic={(course,id)=>void run(()=>commit({...latest.current,courses:latest.current.courses.map(item=>item.id===course.id?{...item,topics:(item.topics||[]).map(topic=>topic.id===id?{...topic,done:!topic.done}:topic)}:item)}))} renderTasks={renderTasks}/></Suspense>}
        {tab === "schedule" && conflicts.size > 0 && <p className="study-overdue" role="status">يوجد تداخل في مواعيد {conflicts.size} محاضرات. افتح المحاضرة لتعديل وقتها.</p>}
        {tab === "schedule" && (<>
            <p className="study-hint">
              أضف المحاضرات والتمارين حسب نظام الجدول الجامعي. التوقيت:{" "}
              {Intl.DateTimeFormat().resolvedOptions().timeZone}.
            </p>
            <Suspense fallback={<p role="status">…</p>}><UniversityTrialSchedule lessons={state.lessons} courses={state.courses} filter={filter} conflicts={conflicts} language={language} courseColor={courseColor} edit={lesson=>setEditing({kind:"lesson",value:lesson})}/></Suspense>
          </>)}
        {tab === "map" && (<>
            <p className="study-hint">
              اسحب الكورسات لترتيب الخريطة. أضف المتطلبات السابقة من «تعديل
              الكورس»؛ السهم يتجه من المتطلب إلى الكورس التالي.
            </p>
            <div className="study-map-scroll" dir="ltr" ref={map}>
              <div className="study-map" style={{
                width: Math.max(900, ...state.courses.map((c) => c.x + 280)),
                height: Math.max(500, ...state.courses.map((c) => c.y + 190)),
            }}>
                <svg aria-hidden="true" width="100%" height="100%">
                  <defs>
                    <marker id="study-arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                      <path d="M0 0L0 6L9 3z" fill="#718373"/>
                    </marker>
                  </defs>
                  {state.courses.flatMap((c) => c.requires.map((id) => {
                const from = state.courses.find((x) => x.id === id);
                return from ? (<path key={id + c.id} d={`M${from.x + 115} ${from.y + 100} C${from.x + 115} ${from.y + 150},${c.x + 115} ${c.y - 50},${c.x + 115} ${c.y}`} fill="none" stroke="#718373" strokeWidth="2" markerEnd="url(#study-arrow)"/>) : null;
            }))}
                </svg>
                {state.courses.map((c) => (<article key={c.id} className="study-node" dir="rtl" style={{
                    left: c.x,
                    top: c.y,
                    borderTopColor: courseColor(c.id),
                }}>
                    <button className="study-drag" dir="auto" onPointerDown={(e) => {
                    if (e.button !== 0)
                        return;
                    e.currentTarget.setPointerCapture(e.pointerId);
                    drag.current = {
                        id: c.id,
                        x: e.clientX,
                        y: e.clientY,
                        startX: c.x,
                        startY: c.y,
                        pointX: c.x,
                        pointY: c.y,
                    };
                }} onPointerMove={(e) => {
                    const d = drag.current;
                    if (!d || d.id !== c.id)
                        return;
                    d.pointX = Math.max(0, d.startX + e.clientX - d.x);
                    d.pointY = Math.max(0, d.startY + e.clientY - d.y);
                    const next = {
                        ...latest.current,
                        courses: latest.current.courses.map((x) => x.id === c.id
                            ? { ...x, x: d.pointX, y: d.pointY }
                            : x),
                    };
                    latest.current = next;
                    setState(next);
                }} onPointerUp={() => {
                    if (drag.current) {
                        drag.current = null;
                        void run(() => commit(latest.current));
                    }
                }} onPointerCancel={() => {
                    drag.current = null;
                    void run(() => commit(latest.current));
                }}>
                      {c.name}
                    </button>
                    <small>{c.requires.length} متطلبات سابقة</small>
                    <button className="study-link-button" onClick={() => setEditing({ kind: "course", value: c })}>
                      تعديل
                    </button>
                  </article>))}
              </div>
            </div>
          </>)}
        {undo&&<section className="study-undo" role="status"><span>تم حذف العنصر.</span><button disabled={busy} onClick={()=>void run(async()=>{
          const next=restoreStudyItem(latest.current,undo);
          if(undo.kind==='tasks'){const task=next.tasks.find(t=>t.id===undo.id)!;if(task.reminderProjectId)await syncReminder(user.uid,task);}
          commit(next);setUndo(null);setMessage('تمت استعادة العنصر.');
        })}>تراجع عن الحذف</button><button aria-label="إغلاق التراجع" onClick={()=>setUndo(null)}>×</button></section>}
        <footer className="study-bottom">
          <p>
            لتلقي التذكيرات، فعّل إشعارات
            المواعيد على هاتفك ثم اختر «تذكير على الهاتف» للمهمة المطلوبة.
          </p>
          <button onClick={() => download("wilo-study-plan.json", planBackup(state))}>
            تصدير بياناتي
          </button>
          <a href="#/notifications">إعدادات الإشعارات</a>
        </footer>
        {capture && !editing && <Modal title="حفظ في خطة الفصل" close={() => setCapture(null)}>
          <StudyCaptureReview capture={capture} state={state} busy={busy} cancel={() => setCapture(null)} confirm={input => void run(async () => {
            const matched = captureMatches(latest.current, capture);
            const result = acceptStudyCapture(latest.current, capture, input);
            if(input.updateExisting&&result.task?.reminderProjectId){const updated=await syncReminder(user.uid,result.task);result.state={...result.state,tasks:result.state.tasks.map(t=>t.id===updated.id?updated:t)};result.task=updated;}
            commit(result.state);
            setFilter(result.course.id);
            setTab("overview");
            setCapture(null);
            if (capture.kind === "course" && matched.course) setEditing({kind:"course",value:result.course});
            else if (result.task && matched.task && !input.updateExisting) setEditing({kind:"task",value:result.task});
            else setMessage("تمت الإضافة إلى خطة الفصل. لم يُفعّل تذكير الهاتف تلقائيًا.");
          })}/>
          {error && <p role="alert" className="study-error">{error}</p>}
        </Modal>}
        {scheduleEdit&&!editing&&<Modal title="بناء جدول الأسبوع" close={()=>setScheduleEdit(null)}><WeeklyScheduleEditor state={scheduleEdit} busy={busy} save={lessons=>void run(()=>{
          if(JSON.stringify(latest.current.lessons)!==JSON.stringify(scheduleEdit.lessons))throw new Error('تغيّر الجدول على جهاز آخر. أعد فتح المحرر لتحميل أحدث نسخة.');
          commit({...latest.current,lessons});setScheduleEdit(null);setTab('schedule');setMessage('تم حفظ جدول الأسبوع.');
        })}/>{error&&<p role="alert" className="study-error">{error}</p>}</Modal>}
        {batchOpen && !editing && <Modal title="إضافة خطة من جدول أو نص" close={() => setBatchOpen(false)}>
          <PlanImport state={state} busy={busy} apply={importPlan}/>
          {error && <p role="alert" className="study-error">{error}</p>}
        </Modal>}
        {preview && !editing && <Modal title="معاينة الإضافات قبل الحفظ" close={() => setPreview(null)}>
          <p>{preview.courses.length} كورس · {preview.tasks.length} مهمة · {preview.lessons.length} محاضرة</p>
          {error && <p role="alert" className="study-error">{error}</p>}
          <ul>{preview.courses.map(c => <li key={c.id} dir="auto">{c.name}</li>)}</ul>
          <p>تُضاف السجلات الجديدة فقط. تبقى تعديلاتك الحالية، ولا تُفعّل تذكيرات النسخة المستعادة.</p>
          <button className="primary-button" disabled={busy} onClick={() => void importPlan(preview)}>تأكيد الإضافة</button>
        </Modal>}
        {editing && (<Modal title={editing.kind === "course"
                ? "بيانات الكورس"
                : editing.kind === "task"
                    ? "مهمة أو امتحان"
                    : "محاضرة أو تمرين"} close={() => setEditing(null)}>
            <form onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void run(async () => {
                    const group=editing.kind==='course'?'courses':editing.kind==='task'?'tasks':'lessons';
                    const current=latest.current[group].find(x=>x.id===editing.value.id);
                    if(current&&JSON.stringify(current)!==JSON.stringify(editing.value))throw new Error('تغيّر هذا العنصر على جهاز آخر؛ أغلق المحرر وافتح أحدث نسخة قبل الحفظ.');
                    if (editing.kind === "course") {
                        const course: Course = {
                            ...editing.value,
                            name: String(f.get("name")).trim(),
                            topics: topicsFromText(String(f.get("topics") || ""), editing.value.topics),
                            notes: String(f.get("notes")),
                            url: resourceUrl(f.get("url")),
                            requires: f.getAll("requires").map(String),
                            x: Math.min(10000, Math.max(0, Number(f.get("x")))),
                            y: Math.min(10000, Math.max(0, Number(f.get("y")))),
                        };
                        validateCourse(course, state.courses);
                        setFilter(course.id);
                        setUniversityLocation(tab, course.id);
                        commit({
                            ...latest.current,
                            courses: [
                                ...latest.current.courses.filter((c) => c.id !== editing.value.id),
                                course,
                            ],
                        });
                    }
                    else if (editing.kind === "task") {
                        const task: StudyTask = {
                            ...editing.value,
                            title: String(f.get("title")).trim(),
                            courseId: String(f.get("courseId")),
                            kind: String(f.get("kind")) as StudyTask["kind"],
                            due: f.get("due")
                                ? new Date(String(f.get("due"))).toISOString()
                                : "",
                            notes: String(f.get("notes")),
                            url: resourceUrl(f.get("url")),
                        };
                        if (!task.title)
                            throw new Error("أضف عنوان المهمة");
                        await saveTask(task);
                    }
                    else {
                        const lesson: Lesson = {
                            ...editing.value,
                            courseId: String(f.get("courseId")),
                            day: Number(f.get("day")),
                            start: String(f.get("start")),
                            end: String(f.get("end")),
                            room: String(f.get("room")),
                            notes: String(f.get("notes")||""),
                        sessionType: String(f.get('sessionType')||'lecture') as Lesson['sessionType'],
                        };
                        if (lesson.end <= lesson.start)
                            throw new Error("وقت النهاية يجب أن يكون بعد البداية");
                        commit({
                            ...latest.current,
                            lessons: [
                                ...latest.current.lessons.filter((l) => l.id !== editing.value.id),
                                lesson,
                            ],
                        });
                    }
                    setEditing(null);
                });
            }}>
              {editing.kind === "course" ? (<>
                  <label>
                    اسم الكورس
                    <input name="name" required maxLength={300} defaultValue={editing.value.name} dir="auto"/>
                  </label>
                  <label>
                    رابط الكورس (اختياري)
                    <input name="url" type="url" defaultValue={editing.value.url} dir="ltr"/>
                  </label>
                  <label>
                    ملاحظات الكورس
                    <textarea name="notes" maxLength={10000} defaultValue={editing.value.notes} dir="auto"/>
                  </label>
                  <label>
                    خطة الدراسة — موضوع في كل سطر
                    <textarea name="topics" rows={5} maxLength={100000} defaultValue={(editing.value.topics || []).map(t => t.title).join("\n")} placeholder={"المحاضرة الأولى\nتمارين الأسبوع الأول\nمراجعة الامتحان"} dir="auto"/>
                  </label>
                  <fieldset>
                    <legend>المتطلبات السابقة</legend>
                    {state.courses
                    .filter((c) => c.id !== editing.value.id)
                    .map((c) => (<label className="study-check" key={c.id}>
                          <input type="checkbox" name="requires" value={c.id} defaultChecked={(editing.value as Course).requires.includes(c.id)}/>
                          {c.name}
                        </label>))}
                  </fieldset>
                  <details className="study-position">
                    <summary>موضع الكورس في الخريطة</summary>
                    <div className="study-form-grid">
                      <label>
                        موضع أفقي
                        <input name="x" type="number" min="0" max="10000" defaultValue={Math.round(editing.value.x)}/>
                      </label>
                      <label>
                        موضع عمودي
                        <input name="y" type="number" min="0" max="10000" defaultValue={Math.round(editing.value.y)}/>
                      </label>
                    </div>
                  </details>
                </>) : (<>
                  <label>
                    الكورس
                    <select name="courseId" defaultValue={editing.value.courseId}>
                      {state.courses.map((c) => (<option key={c.id} value={c.id}>
                          {c.name}
                        </option>))}
                    </select>
                  </label>
                  {editing.kind === "task" ? (<>
                      <label>
                        العنوان
                        <input name="title" required maxLength={500} defaultValue={editing.value.title} dir="auto"/>
                      </label>
                      <div className="study-form-grid">
                        <label>
                          النوع
                          <select name="kind" defaultValue={editing.value.kind}>
                            {Object.entries(kinds).map(([id, title]) => (<option key={id} value={id}>
                                {title}
                              </option>))}
                          </select>
                        </label>
                        <label>
                          التاريخ والوقت
                          <input type="datetime-local" name="due" defaultValue={toLocalInput(editing.value.due)}/>
                        </label>
                      </div>
                      <label>
                        ملاحظات
                        <textarea name="notes" maxLength={10000} defaultValue={editing.value.notes} dir="auto"/>
                      </label>
                      <label>
                        رابط المهمة (اختياري)
                        <input type="url" name="url" defaultValue={editing.value.url} dir="ltr"/>
                      </label>
                    </>) : (<>
                      <label>نوع اللقاء<select name="sessionType" defaultValue={editing.value.sessionType||'lecture'}>{Object.entries(sessionNames).map(([id,title])=><option key={id} value={id}>{title}</option>)}</select></label>
                    <label>
                        اليوم
                        <select name="day" defaultValue={editing.value.day}>
                          {days.map((d, i) => (<option key={d} value={i}>
                              {d}
                            </option>))}
                        </select>
                      </label>
                      <div className="study-form-grid">
                        <label>
                          من
                          <input name="start" type="time" required defaultValue={editing.value.start}/>
                        </label>
                        <label>
                          إلى
                          <input name="end" type="time" required defaultValue={editing.value.end}/>
                        </label>
                      </div>
                      <label>
                        المكان / القاعة
                        <input name="room" maxLength={200} defaultValue={editing.value.room}/>
                      </label><label>ملاحظات<textarea name="notes" maxLength={1000} defaultValue={editing.value.notes||""} dir="auto"/></label>
                    </>)}
                </>)}
              <div className="study-form-actions">
                <button className="primary-button" disabled={busy}>
                  حفظ
                </button>
                {state[editing.kind === "course"
                ? "courses"
                : editing.kind === "task"
                    ? "tasks"
                    : "lessons"].some((x) => x.id === editing.value.id) && (<button type="button" disabled={busy} onClick={() => void run(async () => {
                    const deletion:DeletedStudyItem={kind:editing.kind==='course'?'courses':editing.kind==='task'?'tasks':'lessons',id:editing.value.id,before:latest.current};
                    if (editing.kind === "course") {
                        if (state.tasks.some((t) => t.courseId === editing.value.id) ||
                            state.lessons.some((l) => l.courseId === editing.value.id))
                            throw new Error("انقل أو احذف مهام ومحاضرات الكورس أولًا");
                        commit({
                            ...state,
                            courses: state.courses
                                .filter((c) => c.id !== editing.value.id)
                                .map((c) => ({
                                ...c,
                                requires: c.requires.filter((id) => id !== editing.value.id),
                            })),
                        });
                    }
                    else if (editing.kind === "task") {
                        if (editing.value.reminderProjectId)
                            await syncReminder(user.uid, {
                                ...editing.value,
                                done: true,
                            });
                        commit({
                            ...state,
                            tasks: state.tasks.filter((t) => t.id !== editing.value.id),
                        });
                    }
                    else
                        commit({
                            ...state,
                            lessons: state.lessons.filter((l) => l.id !== editing.value.id),
                        });
                    setUndo(deletion);
                    setEditing(null);
                })}>
                    حذف
                  </button>)}
              </div>
              {error && (<p role="alert" className="study-error">
                  {error}
                </p>)}
            </form>
          </Modal>)}
      </fieldset>
    </section>)}</StudyLocalized>;
}
export default function UniversityPage({ user }: {
    user: User;
}) {
    return <StudyLocalized>{user.emailVerified && db ? (<Workspace key={user.uid} user={user}/>) : (<p role="alert">فعّل بريد حسابك لفتح مساحة الجامعة.</p>)}</StudyLocalized>;
}

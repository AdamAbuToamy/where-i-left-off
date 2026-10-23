import StudyLocalized from "./StudyLocale";
import { useMemo, useState } from 'react';
import type { UniversityState } from './model';
import { lessonConflicts, parsePlanText } from './planImport';
import type { ImportMode, PlanPreview } from './planImport';
const modes = { courses: 'الكورسات', tasks: 'المهام والامتحانات', lessons: 'الجدول الأسبوعي' };
const guides = { courses: 'اسم الكورس | رابط اختياري | ملاحظات اختيارية', tasks: 'الكورس | العنوان | الموعد | النوع | ملاحظات اختيارية', lessons: 'الكورس | اليوم | من | إلى | القاعة' };
const examples = { courses: 'الخوارزميات\nقواعد البيانات', tasks: 'الخوارزميات | تمرين 1 | 2026-11-10 14:30 | وظيفة | حل الأسئلة 1–4', lessons: 'الخوارزميات | الأحد | 09:00 | 11:00 | مبنى 90' };
export default function PlanImport({ state, busy, apply }: {
    state: UniversityState;
    busy: boolean;
    apply: (preview: PlanPreview) => Promise<void>;
}) {
    const [mode, setMode] = useState<ImportMode>('courses'), [raw, setRaw] = useState('');
    const preview = useMemo(() => parsePlanText(raw, mode, state), [raw, mode, state]);
    const count = preview.courses.length + preview.tasks.length + preview.lessons.length;
    const conflicts = lessonConflicts([...state.lessons, ...preview.lessons]);
    return <StudyLocalized>{<div className="study-plan-import">
  <p>انسخ الصفوف من Excel أو Google Sheets والصقها هنا، أو اكتب كل سجل في سطر. لا يحتاج الاستيراد إلى حساب جامعي أو مفتاح.</p>
  <label>ماذا تريد إضافته؟<select value={mode} onChange={e => { setMode(e.target.value as ImportMode); setRaw(''); }}>{Object.entries(modes).map(([key, title]) => <option key={key} value={key}>{title}</option>)}</select></label>
  <p className="study-hint">ترتيب الأعمدة: {guides[mode]}. افصل بينها بزر Tab أو بعلامة |. بدون سطر عناوين.</p>
  {mode === 'tasks' && <p className="study-hint">الأسماء يجب أن تطابق كورساتك. الموعد حسب توقيت جهازك؛ التاريخ وحده يعني الساعة 09:00. النوع: مهمة، وظيفة، أو امتحان.</p>}
  {mode === 'lessons' && <p className="study-hint">أضف الكورسات أولًا. اكتب اسم اليوم والوقت بصيغة 09:00.</p>}
  <label>الصفوف<textarea rows={7} value={raw} maxLength={200000} onChange={e => setRaw(e.target.value)} placeholder={examples[mode]} dir="auto"/></label>
  <details><summary>مثال للنسخ</summary><pre data-study-ui="true" dir="auto">{examples[mode]}</pre></details>
  {!!raw.trim() && <section aria-label="معاينة الدفعة" className="study-batch-preview">
   <h3>المعاينة · {count} سجل جديد</h3>
   {!!preview.skipped && <p>تم تجاوز {preview.skipped} سجل مكرر.</p>}
   {!!preview.errors.length && <div role="alert">{preview.errors.map(e => <p key={e}>{e}</p>)}</div>}
   {!!preview.lessons.some(l => conflicts.has(l.id)) && <p className="study-overdue">يوجد تداخل في مواعيد بعض المحاضرات؛ يمكنك استيرادها ثم تعديل الجدول.</p>}
   <ul>{preview.courses.map(c => <li key={c.id} dir="auto">{c.name}</li>)}{preview.tasks.map(t => <li key={t.id} dir="auto">{t.title} · {state.courses.find(c => c.id === t.courseId)?.name} · {t.due ? new Date(t.due).toLocaleString() : <span data-study-ui="true">بدون موعد</span>}</li>)}{preview.lessons.map(l => <li key={l.id} dir="auto">{state.courses.find(c => c.id === l.courseId)?.name} · {['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'][l.day]} · {l.start}–{l.end} · {l.room}</li>)}</ul>
  </section>}
  <p className="study-hint">لا يُحفظ شيء قبل التأكيد، ولا تُفعّل التذكيرات تلقائيًا.</p>
  <button className="primary-button" disabled={busy || !count || !!preview.errors.length} onClick={() => void apply(preview)}>إضافة الدفعة</button>
 </div>}</StudyLocalized>;
}

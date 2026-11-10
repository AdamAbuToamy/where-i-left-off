import CurriculumConnections from "./CurriculumConnections";
import { useRef, useState } from "react";
import type { CurriculumPlan, CurriculumCourse } from "./curriculum";
import { analyzeCurriculum, validateCurriculum } from "./curriculum";
import { readCurriculumFile } from "./readCurriculumFile";
import { createClientId } from "../lib/clientId";
import "./curriculum.css";
type Props = {
  plans: CurriculumPlan[];
  onSave: (plan: CurriculumPlan, expectedUpdatedAt?:string) => Promise<void> | void;
};
export default function CurriculumMap({ plans, onSave }: Props) {
  const [selected, setSelected] = useState(""),
    [draft, setDraft] = useState<CurriculumPlan | null>(null),
    [warnings, setWarnings] = useState<string[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [focus, setFocus] = useState(""),
    [editing, setEditing] = useState<string | null>(null);
  const upload = useRef(0);
  const baseUpdatedAt=useRef<string|undefined>(undefined);
  const plan = draft || plans.find((p) => p.id === selected) || plans[0];
  async function save() {
    if (!draft) return;
    setError("");
    try {
      const next = validateCurriculum({
        ...draft,
        updatedAt: new Date().toISOString(),
      });
      await onSave(next,baseUpdatedAt.current);
      setSelected(next.id);
      setDraft(null);
      setEditing(null);
      setWarnings([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر الحفظ");
    }
  }
  async function load(file: File) {
    const request = ++upload.current;
    setBusy(true);
    setError("");
    try {
      const result = analyzeCurriculum(await readCurriculumFile(file));
      if (request !== upload.current) return;
      baseUpdatedAt.current=undefined;
      setDraft({
        id: createClientId(),
        name: file.name.replace(/\.[^.]+$/, ""),
        courses: result.courses.map((c) => ({ ...c, id: createClientId() })),
        updatedAt: new Date().toISOString(),
      });
      setWarnings(result.warnings);
      setFocus("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر قراءة الملف");
    } finally {
      if (request === upload.current) setBusy(false);
    }
  }
  const terms = [
    ...new Set((plan?.courses || []).map((c) => `${c.year}:${c.semester}`)),
  ].sort(
    (a, b) =>
      Number(a.split(":")[0]) - Number(b.split(":")[0]) ||
      Number(a.split(":")[1]) - Number(b.split(":")[1]),
  );
  return (
    <section className="curriculum" aria-label="خريطة الخطة الدراسية" dir="rtl">
      <header>
        <div>
          <h2>الخطة الدراسية</h2>
          <p>كل مواد التخصص في خريطة مستقلة؛ لا تضاف إلى كورساتك النشطة.</p>
        </div>
        <label className="curriculum-upload">
          {busy ? "جارٍ تحليل الملف…" : "استيراد خطة دراسية"}
          <input
            aria-label="ملف الخطة الدراسية"
            type="file"
            accept=".xlsx,.docx,.pdf"
            disabled={busy || !!draft}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void load(file);
              e.target.value = "";
            }}
          />
        </label>
      </header>
      <small>
        Excel XLSX · Word DOCX · PDF نصّي، حتى 8 MB. التحليل على جهازك. لا نخمن
        متطلبات سابقة أو سمسترًا غير مذكور.
      </small>
      {error && <p role="alert">{error}</p>}
      {warnings.map((w) => (
        <p key={w} role="status">
          {w}
        </p>
      ))}
      {draft && (
        <div className="curriculum-review">
          <strong>مراجعة قبل الحفظ · {draft.courses.length} كورس</strong>
          <label>
            اسم الخطة
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </label>
          <button
            disabled={busy || !draft.courses.length}
            onClick={() => void save()}
          >
            حفظ الخطة في الخريطة فقط
          </button>
          <button
            onClick={() => {
              upload.current++;
              setDraft(null);
              setWarnings([]);
              setError("");
              setEditing(null);
            }}
          >
            إلغاء التعديلات
          </button>
        </div>
      )}
      {!draft && plans.length > 1 && (
        <label>
          الخطة
          <select
            value={plan?.id || ""}
            onChange={(e) => {
              setSelected(e.target.value);
              setFocus("");
            }}
          >
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {plan && (
        <>
          <div className="curriculum-toolbar">
            <strong>{plan.name}</strong>
            <label>
              التركيز على سمستر
              <select value={focus} onChange={(e) => setFocus(e.target.value)}>
                <option value="">كل الخطة</option>
                {terms.map((term) => (
                  <option key={term} value={term}>
                    {termLabel(term)}
                  </option>
                ))}
              </select>
            </label>
            <button
              onClick={() => {
                if(!draft)baseUpdatedAt.current=plan.updatedAt;
                setDraft({
                  ...plan,
                  courses: [
                    ...plan.courses,
                    {
                      id: createClientId(),
                      code: "",
                      name: "كورس جديد",
                      year: 1,
                      semester: 1,
                      order: plan.courses.length,
                      requires: [],
                    },
                  ],
                });
              }}
            >
              إضافة كورس للخطة
            </button>
          </div>
          <div className="curriculum-grid">
            <CurriculumConnections courses={plan.courses} />
            {terms.map((term) => (
              <section key={term} className="curriculum-term">
                <h3>{termLabel(term)}</h3>
                {plan.courses
                  .filter((c) => `${c.year}:${c.semester}` === term)
                  .sort((a, b) => a.order - b.order)
                  .map((c) => (
                    <article
                      key={c.id}
                      data-curriculum-code={c.code}
                      className={
                        "curriculum-course" +
                        (focus && focus !== term && editing !== c.id
                          ? " curriculum-muted"
                          : "")
                      }
                    >
                      <small dir="auto">{c.code || "رقم غير محدد"}</small>
                      <h4 dir="auto">{c.name}</h4>
                      {c.requires.length > 0 && (
                        <p>المتطلبات ← {c.requires.join("، ")}</p>
                      )}
                      <button
                        onClick={() => {
                          if(!draft)baseUpdatedAt.current=plan.updatedAt;
                          setEditing(editing === c.id ? null : c.id);
                        }}
                      >
                        تعديل / نقل
                      </button>
                      {editing === c.id && (
                        <CourseEditor
                          course={c}
                          onApply={(values) => {
                            setDraft({
                              ...plan,
                              courses: plan.courses.map((item) =>
                                item.id === c.id ? values : item,
                              ),
                            });
                            setEditing(null);
                          }}
                          onRemove={() => {
                            setDraft({
                              ...plan,
                              courses: plan.courses.filter(
                                (item) => item.id !== c.id,
                              ),
                            });
                            setEditing(null);
                          }}
                        />
                      )}
                    </article>
                  ))}
              </section>
            ))}
          </div>
        </>
      )}
      {!plan && !busy && (
        <p>
          ارفع ملف الخطة لتوزيع المواد حسب السنة والسمستر. الجداول ذات الأعمدة
          الواضحة تعطي أفضل نتيجة.
        </p>
      )}
    </section>
  );
}
function termLabel(term: string) {
  const [year, semester] = term.split(":").map(Number);
  return `السنة ${year || "غير محددة"} · ${semester === 3 ? "صيفي" : semester ? "السمستر " + semester : "سمستر غير محدد"}`;
}

function CourseEditor({
  course,
  onApply,
  onRemove,
}: {
  course: CurriculumCourse;
  onApply: (course: CurriculumCourse) => void;
  onRemove: () => void;
}) {
  const [value, setValue] = useState(course),
    [dependencies, setDependencies] = useState(course.requires.join(", "));
  return (
    <div className="curriculum-editor">
      <label>
        رقم الكورس
        <input
          value={value.code}
          onChange={(e) => setValue({ ...value, code: e.target.value })}
        />
      </label>
      <label>
        اسم الكورس
        <input
          value={value.name}
          onChange={(e) => setValue({ ...value, name: e.target.value })}
        />
      </label>
      <label>
        السنة
        <input
          type="number"
          min="1"
          max="10"
          value={value.year}
          onChange={(e) => setValue({ ...value, year: Number(e.target.value) })}
        />
      </label>
      <label>
        السمستر
        <select
          value={value.semester}
          onChange={(e) =>
            setValue({ ...value, semester: Number(e.target.value) })
          }
        >
          <option value="0">اختر</option>
          <option value="1">الأول</option>
          <option value="2">الثاني</option>
          <option value="3">الصيفي</option>
        </select>
      </label>
      <label>
        الترتيب
        <input
          type="number"
          min="0"
          value={value.order}
          onChange={(e) =>
            setValue({ ...value, order: Number(e.target.value) })
          }
        />
      </label>
      <label>
        أرقام المتطلبات، مفصولة بفاصلة
        <input
          value={dependencies}
          onChange={(e) => setDependencies(e.target.value)}
        />
      </label>
      <button
        onClick={() =>
          onApply({
            ...value,
            requires: dependencies
              .split(/[,،]/)
              .map((s) => s.trim())
              .filter(Boolean),
          })
        }
      >
        تطبيق تعديل الكورس
      </button>
      <button onClick={onRemove}>إزالة من الخطة</button>
    </div>
  );
}

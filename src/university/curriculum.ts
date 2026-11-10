export type CurriculumCourse = {
  id: string;
  code: string;
  name: string;
  year: number;
  semester: number;
  order: number;
  requires: string[];
};
export type CurriculumPlan = {
  id: string;
  name: string;
  courses: CurriculumCourse[];
  updatedAt: string;
};
const clean = (v: unknown) =>
  String(v ?? "")
    .normalize("NFKC")
    .replace(/[٠-٩۰-۹]/g, (c) =>
      String(
        "٠١٢٣٤٥٦٧٨٩".includes(c)
          ? "٠١٢٣٤٥٦٧٨٩".indexOf(c)
          : "۰۱۲۳۴۵۶۷۸۹".indexOf(c),
      ),
    )
    .replace(/[\u200e\u200f]/g, "")
    .trim();
const labels = {
  code: /^(course\s*(code|number|no\.?)|code|number|رقم\s*(المادة|الكورس|المساق)|رمز|מספר\s*קורס|מס[\"׳']?\s*קורס|קוד)$/i,
  name: /^(course\s*(name|title)|name|اسم\s*(المادة|الكورس|المساق)|שם\s*ה?קורס|מקצוע)$/i,
  year: /^(year|academic year|السنة|سنة|שנה|שנת לימוד)$/i,
  semester: /^(semester|term|السمستر|الفصل|فصل|סמסטר)$/i,
  requires: /^(prerequisites?|requires|متطلبات|المتطلبات|קדם|דרישות קדם)$/i,
};
function ordinal(value: string): number {
  const v = clean(value).replace(/["'׳״]/g, "");
  const n = v.match(/\d+/);
  if (n) return Number(n[0]);
  const words = [
    "أ|ا|א|first|الأول|الاول|الأولى|الاولى",
    "ب|ב|second|الثاني|الثانية",
    "ج|ג|third|الثالث|الثالثة",
    "د|ד|fourth|الرابع|الرابعة",
    "ה|fifth|الخامس|الخامسة",
    "ו|sixth|السادس|السادسة",
  ];
  return words.findIndex((w) => new RegExp(`^(?:${w})$`, "i").test(v)) + 1;
}
export function validateCurriculum(plan: CurriculumPlan): CurriculumPlan {
  if (
    !plan.id ||
    !plan.name.trim() ||
    plan.name.length > 300 ||
    plan.courses.length > 1000 ||
    !plan.courses.length
  )
    throw new Error("الخطة تحتاج اسمًا ومن 1 إلى 1000 كورس");
  const codes = new Set<string>(),
    ids = new Set<string>();
  for (const c of plan.courses) {
    if (
      !c.id ||
      ids.has(c.id) ||
      !c.code.trim() ||
      codes.has(c.code) ||
      c.code.length > 80 ||
      !c.name.trim() ||
      c.name.length > 300 ||
      !Number.isInteger(c.year) ||
      c.year < 1 ||
      c.year > 10 ||
      !Number.isInteger(c.semester) ||
      c.semester < 1 ||
      c.semester > 3 ||
      !Number.isInteger(c.order) ||
      c.order < 0 ||
      !Array.isArray(c.requires)
    )
      throw new Error(
        "راجع الأرقام والأسماء والسنة والسمستر (1–3)، ولا تكرر رقم كورس",
      );
    ids.add(c.id);
    codes.add(c.code);
  }
  const byCode = new Map(plan.courses.map((c) => [c.code, c]));
  const visited = new Set<string>();
  function visit(code: string, path: Set<string>) {
    if (path.has(code)) throw new Error("المتطلبات السابقة تحتوي حلقة");
    if (visited.has(code)) return;
    const c = byCode.get(code);
    if (!c) throw new Error("متطلب سابق غير موجود في الخطة: " + code);
    for (const dep of c.requires) visit(dep, new Set(path).add(code));
    visited.add(code);
  }
  for (const c of plan.courses) visit(c.code, new Set());
  return plan;
}
/** Deterministic extraction: unknown placement stays zero for review, never guessed. */
export function analyzeCurriculum(rows: string[][]): {
  courses: CurriculumCourse[];
  warnings: string[];
} {
  if (rows.length > 12000)
    throw new Error("الملف يحتوي صفوفًا كثيرة؛ حد أقصى 12000");
  let year = 0,
    semester = 0,
    columns: Partial<Record<keyof typeof labels, number>> = {};
  const courses: CurriculumCourse[] = [],
    warnings: string[] = [];
  for (const raw of rows) {
    const row = raw.map(clean);
    const heading = row.join(" ").trim();
    if (!heading) continue;
    const found: typeof columns = {};
    for (const key of Object.keys(labels) as (keyof typeof labels)[]) {
      const at = row.findIndex((v) => labels[key].test(v));
      if (at >= 0) found[key] = at;
    }
    if (found.code !== undefined && found.name !== undefined) {
      columns = found;
      continue;
    }
    const yh = heading.match(
        /(?:academic year|year|السنة|سنة|שנה|שנת לימוד)\s*[:–-]?\s*([\wא-תأ-ي"'׳״]+)/i,
      ),
      sh = heading.match(
        /(?:semester|term|سمستر|الفصل|فصل|סמסטר)\s*[:–-]?\s*([\wא-תأ-ي"'׳״]+)/i,
      );
    if (yh) {
      year = ordinal(yh[1]);
      semester = 0;
    }
    if (sh) semester = /summer|صيف|קיץ/i.test(sh[1]) ? 3 : ordinal(sh[1]);
    let code = "",
      name = "",
      y = year,
      s = semester,
      requires: string[] = [];
    if (columns.code !== undefined && columns.name !== undefined) {
      code = row[columns.code] || "";
      name = row[columns.name] || "";
      if (columns.year !== undefined) y = ordinal(row[columns.year] || "");
      if (columns.semester !== undefined)
        s = /summer|صيف|קיץ/i.test(row[columns.semester] || "")
          ? 3
          : ordinal(row[columns.semester] || "");
      if (columns.requires !== undefined)
        requires = (row[columns.requires] || "")
          .split(/[,;،]+/)
          .map(clean)
          .filter(Boolean);
    } else {
      const match = heading.match(
        /^([A-Za-z]{0,8}[-.]?\d[\w.-]{1,40})\s+(.+)$/,
      );
      if (match) {
        code = match[1];
        name = match[2];
      } else if(row.length>1){
        const index=row.findIndex(cell=>/^(?:[A-Za-z]{1,8}[-.]?)?\d[\d.-]{2,40}$/.test(cell));
        if(index>=0){code=row[index];name=row.filter((cell,i)=>i!==index&&/[\p{L}]/u.test(cell)).join(' ');}
      }
    }
    if (!code || !name || !/\d/.test(code)) continue;
    const existing = courses.find((c) => c.code === code);
    if (existing) {
      if (
        existing.name !== name ||
        existing.year !== y ||
        existing.semester !== s
      )
        warnings.push("رقم مكرر بمعلومات مختلفة: " + code);
      continue;
    }
    courses.push({
      id: "course-" + courses.length,
      code,
      name,
      year: y,
      semester: s,
      requires,
      order: courses.length,
    });
  }
  if (!courses.length)
    warnings.push(
      "لم نتعرف على كورسات؛ استخدم جدولًا بعناوين: رقم الكورس، اسم الكورس، السنة، الفصل.",
    );
  if (courses.some((c) => !c.year || !c.semester))
    warnings.push("بعض الكورسات دون سنة أو سمستر واضح؛ حددهما قبل الحفظ.");
  return { courses, warnings: [...new Set(warnings)] };
}

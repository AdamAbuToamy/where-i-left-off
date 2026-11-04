import type { CardTemplate, ExperienceState, RepeatRule } from "./state";
import { parseExperience, cardKey } from "./state";
import type { Project } from "../types";
import { FeatureError, day } from "./schema";
export function templateFromCard(
  project: Project,
  id: string,
  title: string,
): CardTemplate {
  return {
    id,
    title,
    name: project.name,
    nextStep: project.nextStep,
    checklist: project.checklist || "",
    description: project.description || "",
  };
}
export function nextRepeatDate(
  current: string,
  frequency: RepeatRule["frequency"],
  anchor: number,
): string {
  day(current);
  if (!current || !Number.isInteger(anchor) || anchor < 1 || anchor > 31)
    throw new FeatureError("experience-invalid");
  const date = new Date(current + "T00:00:00Z");
  if (frequency === "monthly") {
    const year = date.getUTCFullYear(),
      month = date.getUTCMonth() + 1,
      last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    return new Date(Date.UTC(year, month, Math.min(anchor, last)))
      .toISOString()
      .slice(0, 10);
  }
  return new Date(date.getTime() + (frequency === "weekly" ? 7 : 1) * 86400000)
    .toISOString()
    .slice(0, 10);
}
export function latestDue(rule: RepeatRule, today: string): string {
  day(today);
  if (rule.next > today) return "";
  const start = Date.parse(rule.next + "T00:00:00Z"),
    end = Date.parse(today + "T00:00:00Z");
  if (rule.frequency !== "monthly") {
    const step = rule.frequency === "weekly" ? 7 : 1;
    return new Date(
      start + Math.floor((end - start) / (step * 86400000)) * step * 86400000,
    )
      .toISOString()
      .slice(0, 10);
  }
  const d = new Date(today + "T00:00:00Z"),
    last = new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
    ).getUTCDate(),
    candidate = new Date(
      Date.UTC(
        d.getUTCFullYear(),
        d.getUTCMonth(),
        Math.min(rule.anchor, last),
      ),
    )
      .toISOString()
      .slice(0, 10);
  if (candidate <= today) return candidate;
  const previous = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 0));
  return new Date(
    Date.UTC(
      previous.getUTCFullYear(),
      previous.getUTCMonth(),
      Math.min(rule.anchor, previous.getUTCDate()),
    ),
  )
    .toISOString()
    .slice(0, 10);
}
export function occurrence(
  rule: RepeatRule,
  source: Project,
  date = rule.next,
) {
  if (
    !rule.enabled ||
    rule.card !== cardKey(source.id) ||
    source.trashedAt ||
    source.archivedAt
  )
    throw new FeatureError("experience-missing");
  const id = "repeat_" + rule.id + "_" + date;
  if (!/^[-\w]{1,100}$/.test(id)) throw new FeatureError("experience-invalid");
  return {
    id,
    name: source.name,
    nextStep: source.nextStep,
    details: {
      description: source.description || "",
      projectUrl: source.projectUrl || "",
      attachmentUrl: source.attachmentUrl || "",
      links: source.links || [],
      checklist: (source.checklist || "").replace(/^\s*\[x\]/gim, "[ ]"),
      resourceType: source.resourceType || "project",
      sectionId: source.sectionId || "",
      dueDate: date,
      status: "later" as const,
    },
  };
}
export function advanceRepeat(
  state: ExperienceState,
  rule: RepeatRule,
  date: string,
): ExperienceState {
  const current = state.repeat.find((r) => r.id === rule.id);
  if (
    !current ||
    current.next !== rule.next ||
    current.frequency !== rule.frequency ||
    current.anchor !== rule.anchor
  )
    throw new FeatureError("experience-conflict");
  return parseExperience({
    ...state,
    repeat: state.repeat.map((r) =>
      r.id === rule.id
        ? {
            ...r,
            lastOccurrence: date,
            next: nextRepeatDate(date, r.frequency, r.anchor),
          }
        : r,
    ),
  });
}
export function builtinTemplates(ar: boolean): CardTemplate[] {
  return [
    {
      id: "builtin_job",
      title: ar ? "طلب وظيفة" : "Job application",
      name: "",
      nextStep: ar
        ? "راجع متطلبات الوظيفة وجهّز السيرة الذاتية"
        : "Review requirements and prepare your CV",
      description: "",
      checklist: ar
        ? "[ ] تجهيز السيرة الذاتية\n[ ] التقديم\n[ ] المتابعة"
        : "[ ] Prepare CV\n[ ] Apply\n[ ] Follow up",
    },
    {
      id: "builtin_project",
      title: ar ? "مشروع جديد" : "New project",
      name: "",
      nextStep: ar
        ? "حدد أول خطوة صغيرة قابلة للتنفيذ"
        : "Choose the first small actionable step",
      description: "",
      checklist: ar
        ? "[ ] تحديد الهدف\n[ ] التنفيذ\n[ ] المراجعة"
        : "[ ] Define goal\n[ ] Build\n[ ] Review",
    },
    {
      id: "builtin_study",
      title: ar ? "جلسة دراسة" : "Study session",
      name: "",
      nextStep: ar
        ? "اختر موضوعًا وابدأ بتمرين واحد"
        : "Choose a topic and start with one exercise",
      description: "",
      checklist: ar
        ? "[ ] مراجعة الملاحظات\n[ ] حل التمارين\n[ ] تسجيل ما يحتاج متابعة"
        : "[ ] Review notes\n[ ] Practice\n[ ] Record follow-up",
    },
  ];
}

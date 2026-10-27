import { ProjectEntity } from "../../lib/projectEntity";
import { localDateKey } from "../../lib/projects";
import { emptyUniversity } from "../../university/state";
import type { Language } from "../../translations";
import type { StudioState } from "./model";

export function studioSeed(
  now: number,
  displayName: string,
  language: Language,
): StudioState {
  const day = (offset: number) => {
    const date = new Date(now);
    date.setDate(date.getDate() + offset);
    return localDateKey(date);
  };
  const dateTime = (offset: number, hour: number) =>
    new Date(
      day(offset) + "T" + String(hour).padStart(2, "0") + ":00:00",
    ).toISOString();
  const courseNames =
    language === "ar"
      ? ["الخوارزميات", "قواعد البيانات", "الجبر الخطي", "هندسة البرمجيات"]
      : language === "he"
        ? ["אלגוריתמים", "מסדי נתונים", "אלגברה לינארית", "הנדסת תוכנה"]
        : ["Algorithms", "Databases", "Linear algebra", "Software engineering"];
  const courses = courseNames.map((name, i) => ({
    id: "course-" + i,
    name,
    url: "https://ocw.mit.edu/",
    notes:
      language === "ar"
        ? "راجع أفكار المحاضرة، ثم حل تمرينًا واحدًا.\nمواد مفتوحة: https://ocw.mit.edu/"
        : "Review the lecture, then solve one exercise.\nOpen materials: https://ocw.mit.edu/",
    requires: i === 3 ? ["course-0"] : [],
    x: 40 + i * 250,
    y: 40,
    topics: [
      {
        id: "topic-" + i + "-1",
        title: language === "ar" ? "مفاهيم أساسية" : "Foundations",
        done: true,
      },
      {
        id: "topic-" + i + "-2",
        title:
          language === "ar" ? "تمارين وتطبيقات" : "Practice and applications",
        done: false,
      },
      {
        id: "topic-" + i + "-3",
        title: language === "ar" ? "مراجعة واختبار" : "Review and test",
        done: false,
      },
    ],
  }));
  const tasks = courses.map((course, i) => ({
    id: "task-" + i,
    courseId: course.id,
    title:
      language === "ar"
        ? [
            "تسليم مجموعة التمارين",
            "تصميم قاعدة البيانات",
            "مراجعة المصفوفات",
            "عرض المشروع",
          ][i]
        : [
            "Submit exercises",
            "Database design",
            "Review matrices",
            "Project presentation",
          ][i],
    kind: i === 2 ? ("exam" as const) : ("assignment" as const),
    due: dateTime(i - 1, 18),
    done: false,
    notes: "",
    url: "",
  }));
  const personal =
    language === "ar" ? "مساحتي" : language === "he" ? "המרחב שלי" : "My space";
  const projects = [
    {
      name:
        language === "ar"
          ? "صمّم شيئًا يستحق العودة إليه"
          : "Make something worth returning to",
      nextStep:
        language === "ar"
          ? "ارسم أول شاشة ثم اختبرها على الهاتف"
          : "Sketch the first screen, then try it on your phone",
      status: "active" as const,
      resourceType: "project" as const,
      dueDate: day(0),
    },
    {
      name: language === "ar" ? "قراءة عشر صفحات" : "Read ten pages",
      nextStep:
        language === "ar" ? "أكمل الفصل الثالث" : "Continue chapter three",
      status: "later" as const,
      resourceType: "book" as const,
      progressUnits: 42,
      totalUnits: 240,
    },
    {
      name:
        language === "ar" ? "متابعة طلب العمل" : "Follow up on the application",
      nextStep:
        language === "ar"
          ? "راجع الرد ثم حدد الخطوة التالية"
          : "Check the reply and choose the next step",
      status: "waiting" as const,
      resourceType: "project" as const,
      kind: "waiting" as const,
      followUpDate: day(1),
    },
    {
      name:
        language === "ar" ? "فكرة لمشروع جديد" : "An idea for a new project",
      nextStep: "",
      status: "later" as const,
      resourceType: "idea" as const,
    },
  ].map((values, i) =>
    ProjectEntity.create(
      "card-" + i,
      values.name,
      values.nextStep,
      i * 1024,
      { ...values, sectionId: i === 1 ? "reading" : "work" },
      now,
    ).snapshot(),
  );
  const lessons = courses.flatMap((course, i) =>
    [0, 1].map((n) => ({
      id: "lesson-" + i + "-" + n,
      courseId: course.id,
      day: (new Date(now).getDay() + n) % 7,
      start: String(9 + i * 2).padStart(2, "0") + ":00",
      end: String(10 + i * 2).padStart(2, "0") + ":00",
      room: "90 / " + (200 + i),
      sessionType: n ? ("tutorial" as const) : ("lecture" as const),
      notes: "",
    })),
  );
  return {
    version: 1,
    data: {
      study: { ...emptyUniversity(), courses, tasks, lessons },
      scopes: [
        {
          id: "personal",
          name: personal,
          role: "manager",
          projects,
          sections: [
            {
              id: "work",
              name: language === "ar" ? "مشاريعي" : "Projects",
              revision: 0,
            },
            {
              id: "reading",
              name: language === "ar" ? "قراءة وتعلم" : "Reading",
              revision: 0,
            },
          ],
        },
        {
          id: "demo-team",
          name: language === "ar" ? "فريق المشروع" : "Project team",
          role: "manager",
          projects: [],
          sections: [],
        },
      ],
    },
    semesters: [
      {
        id: "current-term",
        name:
          language === "ar"
            ? "الفصل الحالي"
            : language === "he"
              ? "הסמסטר הנוכחי"
              : "Current semester",
        start: day(-14),
        end: day(100),
        archived: false,
      },
    ],
    courseSemesters: Object.fromEntries(
      courses.map((c) => [c.id, "current-term"]),
    ),
    reminders: [],
    sessions: [
      {
        id: "demo-session",
        targetId: "course-0",
        name: courseNames[0],
        seconds: 1500,
        endedAt: now - 86400000,
      },
    ],
    settings: {
      displayName: displayName.trim() || "WILO",
      language,
      mode: "light",
      theme: "emerald",
      background: "plain",
      enabled: false,
      autoArchive: false,
      reminders: true,
      desktop: false,
      reviewDays: 14,
      view: "cards",
    },
  };
}

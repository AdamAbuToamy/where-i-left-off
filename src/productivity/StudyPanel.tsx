import { useState } from "react";
import type { Language } from "../translations";
import ChoicePicker from "../components/ChoicePicker";
import { useExperience } from "./context";
import { useStudySnapshot } from "./useStudySnapshot";
import CourseWorkspace from "./CourseWorkspace";
import { label } from "./helpers";
import { Panel } from "./ui";
export default function StudyPanel({ language }: { language: Language }) {
  const context = useExperience()!,
    study = useStudySnapshot(context.uid),
    [id, setId] = useState(""),
    course =
      study.state.courses.find((c) => c.id === id) || study.state.courses[0],
    t = (a: string, e: string) => label(language, a, e);
  return (
    <Panel title={t("مساحة الجامعة", "University workspace")}>
      <ChoicePicker
        label={t("الكورس", "Course")}
        value={course?.id || ""}
        onChange={setId}
        options={study.state.courses.map((c) => ({
          value: c.id,
          label: c.name,
        }))}
      />
      {!course && (
        <a href="#/university">
          {t("أضف كورسًا من صفحة الجامعة", "Add a course in University")}
        </a>
      )}
      {course && (
        <CourseWorkspace
          key={course.id}
          language={language}
          course={course}
          tasks={study.state.tasks}
          onReview={(tasks) => {
            if (study.error || !study.status.ready)
              throw new Error("experience-pending");
            study.commit({
              ...study.state,
              tasks: [
                ...study.state.tasks,
                ...tasks.filter(
                  (task) => !study.state.tasks.some((t) => t.id === task.id),
                ),
              ],
            });
          }}
        />
      )}
    </Panel>
  );
}

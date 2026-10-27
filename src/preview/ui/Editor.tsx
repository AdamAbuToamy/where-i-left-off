import { useState } from "react";
import type { FormEvent } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { createClientId } from "../../lib/clientId";
import { topicsFromText, toLocalInput } from "../../university/state";
import type { Action } from "../../assistant/actions";
import { usePreview, go } from "./context";
import type { Editor as EditorValue } from "./context";
import Dialog from "./Dialog";
import Disclosure from "./Disclosure";
import { days } from "./words";
export default function Editor({
  value,
  close,
}: {
  value: EditorValue;
  close: () => void;
}) {
  const { state, route, t, run, busy, notify, journal } = usePreview(),
    scope =
      state.data.scopes.find((s) => s.id === route.scope) ||
      state.data.scopes[0];
  const [revision] = useState(() => journal.revision);
  const old = "value" in value ? value.value : undefined;
  const titles = {
    course: t("newCourse"),
    task: t("newTask"),
    lesson: t("newLesson"),
    project: t("newCard"),
    section: t("section"),
    semester: t("semester"),
  };
  const target = {
    course: "courses",
    task: "tasks",
    lesson: "lessons",
    project: "projects",
    section: "sections",
  } as const;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget),
      str = (key: string) => String(f.get(key) || "").trim();
    try {
      if (value.kind === "semester") {
        if (
          await run(
            {
              kind: "semester",
              value: {
                id: createClientId(),
                name: str("name"),
                start: str("start"),
                end: str("end"),
                archived: false,
              },
            },
            revision,
          )
        )
          close();
        return;
      }
      let values: Record<string, unknown> = {};
      if (value.kind === "course")
        values = {
          name: str("name"),
          url: str("url"),
          notes: str("notes"),
          requires: f.getAll("requires").map(String),
          topics: topicsFromText(str("topics"), value.value?.topics),
          x: value.value?.x || 40,
          y: value.value?.y || 40,
        };
      if (value.kind === "task")
        values = {
          title: str("name"),
          courseId: str("courseId"),
          kind: str("kind"),
          due: str("due") ? new Date(str("due")).toISOString() : "",
          notes: str("notes"),
          url: str("url"),
          done: value.value?.done || false,
        };
      if (value.kind === "lesson")
        values = {
          courseId: str("courseId"),
          day: Number(str("day")),
          start: str("start"),
          end: str("end"),
          room: str("room"),
          notes: str("notes"),
          sessionType: str("kind"),
        };
      if (value.kind === "project")
        values = {
          name: str("name"),
          nextStep: str("nextStep"),
          description: str("notes"),
          projectUrl: str("url"),
          dueDate: str("due"),
          sectionId: str("sectionId"),
          status: str("status"),
          rank:
            value.value?.rank ??
            Math.min(0, ...scope.projects.map((project) => project.rank)) -
              1024,
        };
      if (value.kind === "section") values = { name: str("name") };
      const action: Action = {
        target: target[value.kind],
        action: old ? "update" : "create",
        id: old?.id || "new-" + createClientId(),
        scope: scope.id,
        values,
      };
      const ok = await run(
        {
          kind: "actions",
          actions: [action],
          ...(value.kind === "course" ? { semesterId: str("semesterId") } : {}),
        },
        revision,
      );
      if (ok) close();
    } catch {
      notify(t("error"));
    }
  }
  async function remove() {
    if (!old || value.kind === "semester") return;
    if (
      value.kind === "course" &&
      (state.data.study.tasks.some((task) => task.courseId === old.id) ||
        state.data.study.lessons.some((lesson) => lesson.courseId === old.id))
    ) {
      notify(t("deleteCourse"));
      return;
    }
    if (
      await run(
        {
          kind: "actions",
          actions: [
            {
              target: target[value.kind],
              action: value.kind === "project" ? "trash" : "delete",
              id: old.id,
              scope: scope.id,
            },
          ],
        },
        revision,
      )
    ) {
      if (value.kind === "course") go({ course: "", tab: "overview" });
      close();
    }
  }
  const name =
    old && ("name" in old ? old.name : "title" in old ? old.title : "");
  return (
    <Dialog title={old ? t("edit") : titles[value.kind]} close={close}>
      <form className="preview-editor" onSubmit={(e) => void submit(e)}>
        {value.kind !== "lesson" && (
          <label>
            {t("name")}
            <input
              autoFocus
              name="name"
              required
              maxLength={
                value.kind === "project"
                  ? 100
                  : value.kind === "section"
                    ? 60
                    : 300
              }
              defaultValue={name || ""}
              dir="auto"
            />
          </label>
        )}
        {value.kind === "course" && (
          <label>
            {t("semester")}
            <select
              name="semesterId"
              aria-label={t("semester")}
              defaultValue={
                value.value
                  ? state.courseSemesters[value.value.id] || ""
                  : state.semesters.find((term) => term.id === route.term)
                      ?.id ||
                    state.semesters.find((term) => !term.archived)?.id ||
                    ""
              }
            >
              <option value="">—</option>
              {state.semesters.map((term) => (
                <option key={term.id} value={term.id}>
                  {term.name}
                  {term.archived ? " · " + t("archived") : ""}
                </option>
              ))}
            </select>
          </label>
        )}
        {(value.kind === "task" || value.kind === "lesson") && (
          <label>
            {t("course")}
            <select
              aria-label={t("course")}
              name="courseId"
              defaultValue={
                value.value?.courseId ||
                route.course ||
                state.data.study.courses[0]?.id
              }
              required
            >
              {state.data.study.courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {value.kind === "project" && (
          <>
            <label>
              {t("nextStep")}
              <input
                name="nextStep"
                maxLength={1000}
                defaultValue={value.value?.nextStep}
              />
            </label>
            <div className="preview-form-row">
              <label>
                {t("section")}
                <select
                  aria-label={t("section")}
                  name="sectionId"
                  defaultValue={value.value?.sectionId || ""}
                >
                  <option value="">—</option>
                  {scope.sections.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t("status")}
                <select
                  aria-label={t("status")}
                  name="status"
                  defaultValue={value.value?.status || "later"}
                >
                  {(["later", "active", "waiting", "done"] as const).map(
                    (status) => (
                      <option key={status} value={status}>
                        {t(status)}
                      </option>
                    ),
                  )}
                </select>
              </label>
            </div>
          </>
        )}
        {(value.kind === "task" || value.kind === "project") && (
          <label>
            {t("due")}
            <input
              name="due"
              type={value.kind === "task" ? "datetime-local" : "date"}
              defaultValue={
                value.kind === "task"
                  ? toLocalInput(value.value?.due || "")
                  : value.value?.dueDate || ""
              }
            />
          </label>
        )}
        {value.kind === "task" && (
          <label>
            {t("kind")}
            <select
              aria-label={t("kind")}
              name="kind"
              defaultValue={value.value?.kind || "assignment"}
            >
              {(["assignment", "exam", "task"] as const).map((kind) => (
                <option key={kind} value={kind}>
                  {t(kind)}
                </option>
              ))}
            </select>
          </label>
        )}
        {value.kind === "lesson" && (
          <>
            <div className="preview-form-row">
              <label>
                {t("day")}
                <select
                  aria-label={t("day")}
                  name="day"
                  defaultValue={value.value?.day ?? new Date().getDay()}
                >
                  {days[state.settings.language].map((day, i) => (
                    <option key={day} value={i}>
                      {day}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t("kind")}
                <select
                  aria-label={t("kind")}
                  name="kind"
                  defaultValue={value.value?.sessionType || "lecture"}
                >
                  <option value="lecture">{t("lesson")}</option>
                  <option value="tutorial">
                    {state.settings.language === "ar" ? "تمرين" : "Tutorial"}
                  </option>
                  <option value="lab">
                    {state.settings.language === "ar" ? "مختبر" : "Lab"}
                  </option>
                </select>
              </label>
            </div>
            <div className="preview-form-row">
              <label>
                {t("start")}
                <input
                  name="start"
                  type="time"
                  required
                  defaultValue={value.value?.start || "09:00"}
                />
              </label>
              <label>
                {t("end")}
                <input
                  name="end"
                  type="time"
                  required
                  defaultValue={value.value?.end || "10:00"}
                />
              </label>
            </div>
            <label>
              {t("room")}
              <input
                name="room"
                maxLength={200}
                defaultValue={value.value?.room}
              />
            </label>
          </>
        )}
        {value.kind === "semester" && (
          <div className="preview-form-row">
            <label>
              {t("start")}
              <input name="start" type="date" required />
            </label>
            <label>
              {t("end")}
              <input name="end" type="date" required />
            </label>
          </div>
        )}
        {(["course", "task", "lesson", "project"] as const).some(
          (kind) => kind === value.kind,
        ) && (
          <Disclosure
            title={
              <>
                <Plus size={16} />
                {t("details")}
              </>
            }
            initial={value.kind === "course"}
            keepMounted
          >
            {value.kind !== "section" && value.kind !== "semester" && (
              <label>
                {t("notes")}
                <textarea
                  name="notes"
                  rows={3}
                  maxLength={
                    value.kind === "project" || value.kind === "lesson"
                      ? 1000
                      : 10000
                  }
                  defaultValue={
                    value.kind === "project"
                      ? value.value?.description
                      : value.value?.notes
                  }
                />
              </label>
            )}
            {(value.kind === "course" ||
              value.kind === "task" ||
              value.kind === "project") && (
              <label>
                {t("url")}
                <input
                  name="url"
                  type="url"
                  maxLength={500}
                  defaultValue={
                    value.kind === "project"
                      ? value.value?.projectUrl
                      : value.value?.url
                  }
                  dir="ltr"
                />
              </label>
            )}
            {value.kind === "course" && (
              <>
                <label>
                  {t("topics")}
                  <textarea
                    name="topics"
                    rows={4}
                    maxLength={100000}
                    defaultValue={value.value?.topics
                      ?.map((topic) => topic.title)
                      .join("\n")}
                  />
                </label>
                <fieldset>
                  <legend>
                    {state.settings.language === "ar"
                      ? "المتطلبات السابقة"
                      : "Prerequisites"}
                  </legend>
                  {state.data.study.courses
                    .filter((c) => c.id !== old?.id)
                    .map((c) => (
                      <label className="preview-check" key={c.id}>
                        <input
                          name="requires"
                          type="checkbox"
                          value={c.id}
                          defaultChecked={value.value?.requires.includes(c.id)}
                        />
                        {c.name}
                      </label>
                    ))}
                </fieldset>
              </>
            )}
          </Disclosure>
        )}
        <footer className="preview-actions">
          <button type="submit" className="primary-button" disabled={busy}>
            <Save size={17} />
            {t("save")}
          </button>
          <button type="button" className="secondary-button" onClick={close}>
            {t("cancel")}
          </button>
          {old && (
            <button
              type="button"
              className="text-button preview-danger"
              disabled={busy}
              onClick={() => void remove()}
            >
              <Trash2 size={16} />
              {t("remove")}
            </button>
          )}
        </footer>
      </form>
    </Dialog>
  );
}

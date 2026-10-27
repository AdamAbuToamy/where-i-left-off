import { useState } from "react";
import {
  BookOpen,
  BriefcaseBusiness,
  Clapperboard,
  Film,
  Lightbulb,
  ShoppingBag,
  Video,
  GraduationCap,
} from "lucide-react";
import { createClientId } from "../../lib/clientId";
import { topicsFromText, toLocalInput } from "../../university/state";
import type { Course, Lesson, StudyTask } from "../../university/state";
import type { Project } from "../../types";
import type { Action } from "../../assistant/actions";
import { useStudio } from "./context";
import type { EditorRequest } from "./context";
import type { StudioWord } from "./copy";
import { StudioDialog } from "./primitives";

const kinds = {
  project: BriefcaseBusiness,
  book: BookOpen,
  course: GraduationCap,
  video: Video,
  series: Clapperboard,
  film: Film,
  shopping: ShoppingBag,
  idea: Lightbulb,
};
function ProjectFields({ value, scope }: { value?: Project; scope: string }) {
  const { state, t, route } = useStudio(),
    [type, setType] = useState(value?.resourceType || "project");
  return (
    <>
      <div className="st-type-picker">
        {Object.entries(kinds).map(([key, Icon]) => (
          <button
            type="button"
            key={key}
            aria-pressed={type === key}
            onClick={() => setType(key as typeof type)}
          >
            <Icon size={18} />
            {t(key as StudioWord)}
          </button>
        ))}
      </div>
      <input type="hidden" name="resourceType" value={type} />
      <label>
        {t("title")}
        <input
          name="name"
          maxLength={100}
          required
          defaultValue={value?.name || ""}
          dir="auto"
          autoFocus
        />
      </label>
      <label>
        {t("nextStep")}
        <textarea
          name="nextStep"
          rows={2}
          maxLength={1000}
          defaultValue={value?.nextStep || ""}
          dir="auto"
        />
      </label>
      <div className="st-form-grid">
        <label>
          {t("due")}
          <input
            type="date"
            name="dueDate"
            defaultValue={value?.dueDate || ""}
          />
        </label>
        <label>
          {t("section")}
          <select
            name="sectionId"
            defaultValue={
              value?.sectionId ?? (route.section === "all" ? "" : route.section)
            }
          >
            <option value="">{t("unassigned")}</option>
            {state.data.scopes
              .find((s) => s.id === scope)
              ?.sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </select>
        </label>
      </div>
      <details className="st-optional">
        <summary>{t("details")}</summary>
        <div className="st-form-stack">
          <label>
            {t("status")}
            <select name="status" defaultValue={value?.status || "later"}>
              {(["later", "active", "waiting", "done"] as const).map((s) => (
                <option key={s} value={s}>
                  {t(s)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("notes")}
            <textarea
              name="description"
              rows={4}
              maxLength={1000}
              defaultValue={value?.description || ""}
              dir="auto"
            />
          </label>
          <label>
            {t("checkpoint")}
            <textarea
              name="checkpoint"
              maxLength={1000}
              defaultValue={value?.checkpoint || ""}
              dir="auto"
            />
          </label>
          <label>
            {t("checklist")}
            <textarea
              name="checklist"
              maxLength={3000}
              rows={4}
              defaultValue={value?.checklist || ""}
              dir="auto"
            />
          </label>
          <div className="st-form-grid">
            <label>
              {t("progress")}
              <input
                name="progressUnits"
                type="number"
                min="0"
                max="1000000"
                defaultValue={value?.progressUnits || 0}
              />
            </label>
            <label>
              {t("total")}
              <input
                name="totalUnits"
                type="number"
                min="0"
                max="1000000"
                defaultValue={value?.totalUnits || 0}
              />
            </label>
          </div>
          <label>
            {t("followUp")}
            <input
              name="followUpDate"
              type="date"
              defaultValue={value?.followUpDate || ""}
            />
          </label>
          <label>
            {t("url")}
            <input
              name="projectUrl"
              type="url"
              maxLength={500}
              defaultValue={value?.projectUrl || ""}
              dir="ltr"
            />
          </label>
          <label>
            {t("attachment")}
            <input
              name="attachmentUrl"
              type="url"
              maxLength={500}
              defaultValue={value?.attachmentUrl || ""}
              dir="ltr"
            />
          </label>
          <label>
            {t("links")}
            <textarea
              name="links"
              rows={3}
              maxLength={5000}
              defaultValue={value?.links?.join("\n") || ""}
              dir="ltr"
            />
          </label>
        </div>
      </details>
    </>
  );
}
function CourseFields({ value }: { value?: Course }) {
  const { state, t } = useStudio();
  return (
    <>
      <label>
        {t("name")}
        <input
          name="name"
          required
          maxLength={300}
          defaultValue={value?.name || ""}
          autoFocus
          dir="auto"
        />
      </label>
      <label>
        {t("notes")}
        <textarea
          name="notes"
          maxLength={10000}
          rows={5}
          defaultValue={value?.notes || ""}
          dir="auto"
        />
      </label>
      <label>
        {t("url")}
        <input
          name="url"
          type="url"
          defaultValue={value?.url || ""}
          dir="ltr"
        />
      </label>
      <details className="st-optional">
        <summary>{t("plan")}</summary>
        <label>
          {t("topics")}
          <textarea
            name="topics"
            rows={5}
            maxLength={100000}
            defaultValue={
              value?.topics?.map((topic) => topic.title).join("\n") || ""
            }
            dir="auto"
          />
        </label>
        <fieldset>
          <legend>{t("requires")}</legend>
          {state.data.study.courses
            .filter((c) => c.id !== value?.id)
            .map((c) => (
              <label className="st-checkbox" key={c.id}>
                <input
                  name="requires"
                  type="checkbox"
                  value={c.id}
                  defaultChecked={value?.requires.includes(c.id)}
                />
                <span dir="auto">{c.name}</span>
              </label>
            ))}
        </fieldset>
      </details>
    </>
  );
}
function TaskFields({
  value,
  courseId,
}: {
  value?: StudyTask;
  courseId?: string;
}) {
  const { state, t } = useStudio();
  return (
    <>
      <label>
        {t("title")}
        <input
          name="title"
          required
          maxLength={500}
          defaultValue={value?.title || ""}
          autoFocus
          dir="auto"
        />
      </label>
      <label>
        {t("course")}
        <select
          name="courseId"
          defaultValue={
            value?.courseId || courseId || state.data.study.courses[0]?.id
          }
        >
          {state.data.study.courses.map((c) => (
            <option value={c.id} key={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <div className="st-form-grid">
        <label>
          {t("date")}
          <input
            name="due"
            type="datetime-local"
            defaultValue={toLocalInput(value?.due || "")}
          />
        </label>
        <label>
          {t("type")}
          <select name="kind" defaultValue={value?.kind || "assignment"}>
            {(["assignment", "exam", "task"] as const).map((k) => (
              <option value={k} key={k}>
                {t(k)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        {t("notes")}
        <textarea
          name="notes"
          rows={4}
          maxLength={10000}
          defaultValue={value?.notes || ""}
          dir="auto"
        />
      </label>
      <label>
        {t("url")}
        <input
          name="url"
          type="url"
          defaultValue={value?.url || ""}
          dir="ltr"
        />
      </label>
    </>
  );
}
function LessonFields({
  value,
  courseId,
}: {
  value?: Lesson;
  courseId?: string;
}) {
  const { state, t } = useStudio();
  return (
    <>
      <label>
        {t("course")}
        <select
          name="courseId"
          defaultValue={
            value?.courseId || courseId || state.data.study.courses[0]?.id
          }
        >
          {state.data.study.courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <div className="st-form-grid">
        <label>
          {t("day")}
          <select name="day" defaultValue={value?.day ?? new Date().getDay()}>
            {Array.from({ length: 7 }, (_, day) => (
              <option key={day} value={day}>
                {new Intl.DateTimeFormat(state.settings.language, {
                  weekday: "long",
                  timeZone: "UTC",
                }).format(new Date(Date.UTC(2026, 9, 18 + day)))}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("type")}
          <select
            name="sessionType"
            defaultValue={value?.sessionType || "lecture"}
          >
            {(["lecture", "tutorial", "lab"] as const).map((k) => (
              <option key={k} value={k}>
                {t(k)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("start")}
          <input
            type="time"
            name="start"
            required
            defaultValue={value?.start || "09:00"}
          />
        </label>
        <label>
          {t("end")}
          <input
            type="time"
            name="end"
            required
            defaultValue={value?.end || "10:00"}
          />
        </label>
      </div>
      <label>
        {t("room")}
        <input
          name="room"
          maxLength={200}
          defaultValue={value?.room || ""}
          dir="auto"
        />
      </label>
      <label>
        {t("notes")}
        <textarea
          name="notes"
          maxLength={1000}
          defaultValue={value?.notes || ""}
          dir="auto"
        />
      </label>
    </>
  );
}
export default function StudioEditor({
  request,
  close,
}: {
  request: EditorRequest;
  close: () => void;
}) {
  const { run, t, busy, notify, state, route } = useStudio();
  const titles: Record<EditorRequest["kind"], StudioWord> = {
    project: "newCard",
    course: "newCourse",
    task: "newTask",
    lesson: "newLesson",
    semester: "newSemester",
    section: "newSection",
    group: "newGroup",
  };
  const value = "value" in request ? request.value : undefined;
  async function save(form: HTMLFormElement) {
    const data = new FormData(form),
      string = (key: string) => String(data.get(key) || "");
    try {
      let ok = false;
      if (request.kind === "semester")
        ok = await run({
          kind: "semester",
          value: {
            id: createClientId(),
            name: string("name").trim(),
            start: string("start"),
            end: string("end"),
            archived: false,
          },
        });
      else if (request.kind === "group")
        ok = await run({
          kind: "group",
          id: createClientId(),
          name: string("name").trim(),
        });
      else {
        const values: Record<string, unknown> = {},
          target =
            request.kind === "project"
              ? "projects"
              : request.kind === "course"
                ? "courses"
                : request.kind === "task"
                  ? "tasks"
                  : request.kind === "lesson"
                    ? "lessons"
                    : "sections";
        if (request.kind === "project") {
          for (const key of [
            "name",
            "nextStep",
            "resourceType",
            "sectionId",
            "dueDate",
            "description",
            "checkpoint",
            "checklist",
            "followUpDate",
            "projectUrl",
            "attachmentUrl",
          ])
            values[key] = string(key);
          values.status = string("status") || "later";
          if (!value)
            values.rank =
              Math.min(
                0,
                ...state.data.scopes
                  .find((scope) => scope.id === request.scope)!
                  .projects.map((project) => project.rank),
              ) - 1024;
          values.progressUnits = Number(string("progressUnits"));
          values.totalUnits = Number(string("totalUnits"));
          values.links = string("links")
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean);
        } else if (request.kind === "course")
          Object.assign(values, {
            name: string("name").trim(),
            notes: string("notes"),
            url: string("url"),
            topics: topicsFromText(string("topics"), request.value?.topics),
            requires: data.getAll("requires").map(String),
          });
        else if (request.kind === "task")
          Object.assign(values, {
            title: string("title").trim(),
            courseId: string("courseId"),
            kind: string("kind"),
            due: string("due") ? new Date(string("due")).toISOString() : "",
            notes: string("notes"),
            url: string("url"),
          });
        else if (request.kind === "lesson")
          Object.assign(values, {
            courseId: string("courseId"),
            day: Number(string("day")),
            start: string("start"),
            end: string("end"),
            room: string("room"),
            sessionType: string("sessionType"),
            notes: string("notes"),
          });
        else values.name = string("name").trim();
        const action: Action = {
          target,
          action: value ? "update" : "create",
          id: value?.id || createClientId(),
          scope: "scope" in request ? request.scope : "personal",
          values,
        };
        ok = await run({
          kind: "actions",
          actions: [action],
          semesterId:
            request.kind === "course" && !value
              ? state.semesters.find(
                  (term) => term.id === route.term && !term.archived,
                )?.id || state.semesters.find((term) => !term.archived)?.id
              : undefined,
        });
      }
      if (ok) close();
    } catch {
      notify(t("failed"));
    }
  }
  return (
    <StudioDialog
      title={value ? t("edit") : t(titles[request.kind])}
      close={close}
    >
      <form
        className="st-form-stack"
        onSubmit={(event) => {
          event.preventDefault();
          void save(event.currentTarget);
        }}
      >
        {request.kind === "project" ? (
          <ProjectFields value={request.value} scope={request.scope} />
        ) : request.kind === "course" ? (
          <CourseFields value={request.value} />
        ) : request.kind === "task" ? (
          <TaskFields value={request.value} courseId={request.courseId} />
        ) : request.kind === "lesson" ? (
          <LessonFields value={request.value} courseId={request.courseId} />
        ) : (
          <>
            <label>
              {t("name")}
              <input
                name="name"
                required
                maxLength={request.kind === "section" ? 60 : 100}
                defaultValue={
                  request.kind === "section" ? request.value?.name : undefined
                }
                dir="auto"
                autoFocus
              />
            </label>
            {request.kind === "semester" && (
              <div className="st-form-grid">
                <label>
                  {t("start")}
                  <input type="date" name="start" />
                </label>
                <label>
                  {t("end")}
                  <input type="date" name="end" />
                </label>
              </div>
            )}
          </>
        )}
        <footer className="st-dialog-actions">
          {value && ["course", "task", "lesson"].includes(request.kind) && (
            <button
              type="button"
              className="st-secondary"
              disabled={busy}
              onClick={() => {
                if (
                  request.kind === "course" &&
                  (state.data.study.tasks.some(
                    (task) => task.courseId === value.id,
                  ) ||
                    state.data.study.lessons.some(
                      (lesson) => lesson.courseId === value.id,
                    ))
                ) {
                  notify(t("courseHasItems"));
                  return;
                }
                const target =
                  request.kind === "course"
                    ? "courses"
                    : request.kind === "task"
                      ? "tasks"
                      : "lessons";
                void run({
                  kind: "actions",
                  actions: [{ target, action: "delete", id: value.id }],
                }).then((ok) => {
                  if (ok) close();
                });
              }}
            >
              {t("delete")}
            </button>
          )}

          <button type="submit" className="st-primary" disabled={busy}>
            {t("save")}
          </button>
          <button
            type="button"
            className="st-secondary"
            onClick={close}
            disabled={busy}
          >
            {t("cancel")}
          </button>
        </footer>
      </form>
    </StudioDialog>
  );
}

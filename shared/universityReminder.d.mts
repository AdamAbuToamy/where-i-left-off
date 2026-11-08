import type { StudyTask } from "../src/university/model";
import type { Project } from "../src/types";
export function reminderCardFields(
  task: StudyTask,
  previous: Partial<Project> | undefined,
  now: number,
): Pick<
  Project,
  | "name"
  | "nextStep"
  | "projectUrl"
  | "dueDate"
  | "status"
  | "kind"
  | "resourceType"
  | "rank"
  | "revision"
>;

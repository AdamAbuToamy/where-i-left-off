import type { StudyTask } from "../src/university/state";
export function sameImportedStudyTask(
  a: Pick<StudyTask, "courseId" | "title" | "kind" | "due">,
  b: Pick<StudyTask, "courseId" | "title" | "kind" | "due">,
): boolean;

export function sameStudySourceLink(a:string,b:string):boolean;

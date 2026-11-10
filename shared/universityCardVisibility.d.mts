export function universityReminderProjectIds(
  tasks: ReadonlyArray<{ reminderProjectId?: string }>,
): Set<string>;
export function isUniversityReminderProject(
  project: { id: string; kind?: string; resourceType?: string },
  linkedIds: ReadonlySet<string>,
): boolean;
export function universityReminderProjectIdsFromRecords(
  records: ReadonlyArray<{
    kind?: string;
    deleted?: boolean;
    id?: string;
    payload?: string;
  }>,
): Set<string>;

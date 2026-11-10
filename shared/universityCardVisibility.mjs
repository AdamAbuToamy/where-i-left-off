/** A reminder backing record is not an explicitly created personal card.
 * Classify by a persisted task link AND native helper type, never by title/URL.
 * Keep these records in storage and notification enumeration. */
export function universityReminderProjectIds(tasks) {
  return new Set(
    tasks
      .map((task) => task?.reminderProjectId)
      .filter((id) => typeof id === "string" && /^[A-Za-z0-9]{20}$/.test(id)),
  );
}
export function isUniversityReminderProject(project, linkedIds) {
  return (
    linkedIds.has(project.id) &&
    project.kind === "deadline" &&
    project.resourceType === "course"
  );
}

export function universityReminderProjectIdsFromRecords(records) {
  const tasks = records.flatMap((record) => {
    if (
      record.kind !== "tasks" ||
      record.deleted ||
      typeof record.payload !== "string"
    )
      return [];
    try {
      const task = JSON.parse(record.payload);
      return task?.id === record.id ? [task] : [];
    } catch {
      return [];
    }
  });
  return universityReminderProjectIds(tasks);
}

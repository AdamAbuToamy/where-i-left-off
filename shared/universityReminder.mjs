/** Native university reminder card fields, shared by browser and Public API. */
export function reminderCardFields(task, previous, now) {
  return {
    name: task.title.slice(0, 100),
    nextStep: task.notes.slice(0, 1000),
    projectUrl: task.url,
    dueDate: "",
    status: task.done ? "done" : "active",
    kind: "deadline",
    resourceType: "course",
    rank: previous?.rank ?? now,
    revision: previous ? Number(previous.revision || 0) + 1 : 0,
  };
}

/** Existing text-import duplicate identity; source URL matching remains authoritative for Moodle. */
export function sameImportedStudyTask(a, b) {
  const fold = (s) => s.trim().replace(/\s+/g, " ").toLocaleLowerCase();
  return (
    a.courseId === b.courseId &&
    fold(a.title) === fold(b.title) &&
    a.kind === b.kind &&
    a.due === b.due
  );
}

/** Existing Chrome capture identity: host, activity path and stable id parameter. */
export function sameStudySourceLink(a, b) {
  try {
    const x = new URL(a),
      y = new URL(b);
    return (
      x.origin === y.origin &&
      x.pathname === y.pathname &&
      x.searchParams.get("id") === y.searchParams.get("id")
    );
  } catch {
    return false;
  }
}

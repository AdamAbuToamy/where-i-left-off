import { AssistantRepository } from "../../assistant/assistantRepository";
import { isAdmin } from "../../lib/admin";
import { auth } from "../../lib/firebase";
import { validatePreviewState } from "../core/validation";
import type { PreviewState } from "../core/model";

/** One-way copy. This adapter exposes no production writer, reminder or profile mutation. */
export async function copyAccountIntoPreview(
  uid: string,
  base: PreviewState,
): Promise<PreviewState> {
  const check = () => {
    const u = auth?.currentUser;
    if (u?.uid !== uid || !isAdmin(u.email, u.emailVerified))
      throw new Error("preview-permission");
  };
  check();
  const snapshot = await new AssistantRepository(uid).read();
  check();
  if (snapshot.pending) throw new Error("preview-account-pending");
  const data = structuredClone(snapshot.data);
  data.study.tasks = data.study.tasks.map((task) => {
    const copy = { ...task };
    delete copy.reminderProjectId;
    return copy;
  });
  return validatePreviewState({
    ...base,
    data,
    courseSemesters: {},
    reminders: [],
    sessions: [],
  });
}

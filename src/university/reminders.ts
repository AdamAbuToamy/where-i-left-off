import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { pushCall } from "../lib/pushNotifications";
import type { PushState } from "../lib/pushNotifications";
import { toLocalInput } from "./model";
import type { StudyTask } from "./model";
/** University records stay local; only explicitly linked reminder cards enter the user's workspace. */
export function prepareReminder(task: StudyTask): StudyTask {
  if (!db) throw new Error("سجّل الدخول أولًا");
  return task.reminderProjectId
    ? task
    : {
        ...task,
        reminderProjectId: doc(
          collection(db, "users", auth!.currentUser!.uid, "projects"),
        ).id,
      };
}
export async function syncReminder(
  uid: string,
  task: StudyTask,
  create = false,
): Promise<StudyTask> {
  if (!db || auth?.currentUser?.uid !== uid)
    throw new Error("سجّل الدخول أولًا");
  if (!task.reminderProjectId && !create) return task;
  if (!task.due || !Number.isFinite(Date.parse(task.due)))
    throw new Error("أضف موعدًا صحيحًا أولًا");
  const state = await pushCall<PushState>({ action: "get" });
  if (
    state.preferences.timezone !==
    Intl.DateTimeFormat().resolvedOptions().timeZone
  )
    throw new Error(
      "توقيت جهازك مختلف عن توقيت التذكيرات؛ وحّد المنطقة الزمنية في إعدادات الإشعارات أولًا",
    );
  if (create && (!state.preferences.enabled || !state.preferences.due))
    throw new Error(
      "فعّل تذكيرات مواعيد المهام من إعدادات الإشعارات على الهاتف أولًا",
    );
  const reference = task.reminderProjectId
    ? doc(db, "users", uid, "projects", task.reminderProjectId)
    : doc(collection(db, "users", uid, "projects"));
  const local = toLocalInput(task.due);
  // Pause delivery while updating the linked card, then publish its exact local date after preferences succeed.
  let missing = false;
  await runTransaction(db, async (transaction) => {
    missing = false;
    if (auth?.currentUser?.uid !== uid) throw new Error("انتهت جلسة الدخول");
    const current = await transaction.get(reference);
    if (!create && !current.exists()) {
      missing = true;
      return;
    }
    const previous = current.data();
    transaction.set(reference, {
      ...(previous || {}),
      name: task.title.slice(0, 100),
      nextStep: task.notes.slice(0, 1000),
      projectUrl: task.url,
      dueDate: "",
      status: task.done ? "done" : "active",
      kind: "deadline",
      resourceType: "course",
      rank: previous?.rank ?? Date.now(),
      revision: current.exists() ? Number(previous?.revision || 0) + 1 : 0,
      updatedAt: serverTimestamp(),
    });
  });
  if (missing) {
    const unlinked = { ...task };
    delete unlinked.reminderProjectId;
    return unlinked;
  }
  await pushCall({
    action: "card",
    projectId: reference.id,
    groupId: "",
    disabled: task.done,
    weekly: false,
    time: local.slice(11),
  });
  await runTransaction(db, async (transaction) => {
    if (auth?.currentUser?.uid !== uid) throw new Error("انتهت جلسة الدخول");
    const current = await transaction.get(reference);
    if (!current.exists()) throw new Error("بطاقة التذكير حُذفت");
    transaction.update(reference, {
      dueDate: local.slice(0, 10),
      revision: Number(current.data().revision) + 1,
      updatedAt: serverTimestamp(),
    });
  });
  window.dispatchEvent(new Event("push-preferences-changed"));
  return { ...task, reminderProjectId: reference.id };
}

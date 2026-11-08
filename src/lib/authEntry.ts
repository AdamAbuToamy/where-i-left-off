import type { User } from "firebase/auth";
// Presentation boundary only. No age/birthdate, provider token or account content is persisted.
const pendingKey = "wilo-google-registration-pending";
const listeners = new Set<() => void>();
let holding = false;
let pendingUid = "";
let arrivalUid = "";
function emit() {
  listeners.forEach((listener) => listener());
}
export function holdAuthEntry() {
  arrivalUid = "";
  holding = true;
  emit();
}
export function pendingGoogleRegistration(user: User | null): User | null {
  if (!user) return null;
  let stored = "";
  try {
    stored = localStorage.getItem(pendingKey) || "";
  } catch {
    /* Optional recovery marker. */
  }
  return pendingUid === user.uid || stored === user.uid ? user : null;
}
export function markGoogleRegistration(user: User) {
  pendingUid = user.uid;
  try {
    localStorage.setItem(pendingKey, user.uid);
  } catch {
    /* Keep the in-memory gate. */
  }
  holding = true;
  emit();
}
export function authEntryHeld(user: User | null) {
  return holding || !!pendingGoogleRegistration(user);
}
export function finishAuthEntry(user: User | null, arrive = false) {
  if (user) {
    pendingUid = "";
    try {
      if (localStorage.getItem(pendingKey) === user.uid)
        localStorage.removeItem(pendingKey);
    } catch {
      /* Optional marker. */
    }
  }
  holding = false;
  if (arrive && user) arrivalUid = user.uid;
  emit();
}
export function releaseAuthEntry() {
  holding = false;
  emit();
}
export function subscribeAuthEntry(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function takeAuthArrival(uid: string) {
  const found = !!uid && arrivalUid === uid;
  if (found) arrivalUid = "";
  return found;
}

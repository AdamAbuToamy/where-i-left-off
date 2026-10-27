import { auth } from "../../lib/firebase";
import { isAdmin } from "../../lib/admin";
import {
  connectPollinations,
  pollinationsKey,
} from "../../assistant/pollinationsAuth";
const PREFIX = "wilo-studio-pollinations:";
const DISCONNECTED = "!disconnected";
function check(uid: string) {
  const user = auth?.currentUser;
  if (user?.uid !== uid || !isAdmin(user.email, user.emailVerified))
    throw new Error("studio-permission");
}
/** An existing same-account session may be reused, but preview connect/disconnect never modifies it. */
export function studioPollinationsKey(uid: string): string {
  check(uid);
  const key = sessionStorage.getItem(PREFIX + uid);
  if (key === DISCONNECTED) throw new Error("assistant-connect-required");
  return key || pollinationsKey(uid);
}
export function studioPollinationsConnected(uid: string): boolean {
  try {
    return !!studioPollinationsKey(uid);
  } catch {
    return false;
  }
}
export function connectStudioPollinations(uid: string): Promise<void> {
  check(uid);
  return connectPollinations(uid, (key) => {
    check(uid);
    sessionStorage.setItem(PREFIX + uid, key);
  });
}
export function disconnectStudioPollinations(uid: string) {
  check(uid);
  sessionStorage.setItem(PREFIX + uid, DISCONNECTED);
}

type Listener = { uid: string; open: () => void };
const listeners = new Set<Listener>();
let pending: string | null = null;
/** Retain a first tap while the lazy assistant module is still loading. */
export function requestAssistantOpen(uid: string) {
  const targets = [...listeners].filter((listener) => listener.uid === uid);
  if (!targets.length) {
    pending = uid;
    return;
  }
  pending = null;
  targets.forEach((listener) => listener.open());
}
export function subscribeAssistantOpen(uid: string, open: () => void) {
  const listener = { uid, open };
  listeners.add(listener);
  if (pending === uid)
    queueMicrotask(() => {
      if (pending === uid && listeners.has(listener)) {
        pending = null;
        open();
      }
    });
  return () => {
    listeners.delete(listener);
  };
}

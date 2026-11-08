import { flushSync } from "react-dom";
let active: ViewTransition | undefined;
export function cancelSceneTransition() {
  active?.skipTransition();
  active = undefined;
}
/** Route-only snapshots: no history interception, delayed saves or input animation. */
export function transitionScene(update: () => void) {
  const enabled =
    document.documentElement.dataset.cinematic === "on" &&
    !matchMedia("(prefers-reduced-motion: reduce)").matches &&
    !document.querySelector(
      "dialog[open],.assistant-panel,.card-detail-panel,.phone-form-fullscreen",
    );
  active?.skipTransition();
  if (!enabled || typeof document.startViewTransition !== "function") {
    update();
    return;
  }
  let applied = false;
  const apply = () => {
    if (!applied) {
      applied = true;
      flushSync(update);
    }
  };
  try {
    const transition = document.startViewTransition(apply);
    active = transition;
    void transition.ready.catch(() => {});
    void transition.finished
      .catch(() => {})
      .finally(() => {
        if (active === transition) active = undefined;
      });
  } catch {
    apply();
  }
}

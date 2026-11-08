import { cancelSceneTransition } from "./sceneNavigation";
import type { ExperiencePreferences } from "./preferences";

/** Browser-only choreography. Never changes routes, focus, data or form layout. */
export function installSceneMotion(preference: ExperiencePreferences) {
  const media = matchMedia("(prefers-reduced-motion: reduce)");
  let stop: (() => void) | undefined;
  const start = () => {
    stop?.();
    stop = media.matches ? undefined : mountScene(preference);
  };
  start();
  media.addEventListener("change", start);
  return () => {
    media.removeEventListener("change", start);
    stop?.();
  };
}
function mountScene(preference: ExperiencePreferences) {
  const dramatic = preference.intensity === "dramatic";
  const layer = document.createElement("div");
  layer.className = "wilo-scene-effects";
  layer.setAttribute("aria-hidden", "true");
  layer.innerHTML = `${preference.ambient ? '<div class="scene-atmosphere"><i></i><i></i><i></i><i></i></div>' : ""}<div class="scene-cut"><i></i><i></i></div><div class="scene-nav-beacon"></div>`;
  document.body.append(layer);
  const beacon = layer.querySelector<HTMLElement>(".scene-nav-beacon")!;
  const cut = layer.querySelector<HTMLElement>(".scene-cut")!;
  const seen = new WeakSet<Element>();
  const animations = new Set<Animation>();
  let frame = 0,
    burstTimer = 0,
    routeTimer = 0;
  const play = (
    el: Element,
    frames: Keyframe[],
    options: KeyframeAnimationOptions,
  ) => {
    const a = el.animate(frames, { ...options, fill: "none" });
    animations.add(a);
    a.finished.catch(() => {}).finally(() => animations.delete(a));
    return a;
  };
  const inView = new IntersectionObserver(
    (entries) => {
      let index = 0;
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        inView.unobserve(entry.target);
        if (document.hidden || entry.target.contains(document.activeElement))
          continue;
        // Do not transform input ancestors: mobile keyboards and fixed panels stay stable.
        const form =
          entry.target.matches(
            ".new-project-form,.card-editor,.assistant-panel,.card-detail-panel",
          ) ||
          !!entry.target.querySelector(
            "textarea,select,input:not([type=checkbox]):not([type=radio]):not([type=hidden])",
          );
        play(
          entry.target,
          form
            ? [{ opacity: 0.35 }, { opacity: 1 }]
            : [
                {
                  opacity: 0.15,
                  transform: `translateY(${dramatic ? 34 : 12}px) scale(.98)`,
                },
                { opacity: 1, transform: "none" },
              ],
          {
            duration: dramatic ? 760 : 300,
            delay: Math.min(index++ * 45, 240),
            easing: "cubic-bezier(.16,1,.3,1)",
          },
        );
      }
    },
    { threshold: 0.08 },
  );
  const positionBeacon = () => {
    const active = document.querySelector<HTMLElement>(
      ".mobile-bottom-navigation a[aria-current=page]",
    );
    if (!active || !active.getClientRects().length) {
      beacon.hidden = true;
      return;
    }
    const box = active.getBoundingClientRect();
    beacon.hidden = false;
    beacon.style.width = `${Math.min(48, box.width - 12)}px`;
    beacon.style.transform = `translate3d(${box.x + box.width / 2 - Math.min(48, box.width - 12) / 2}px,${box.y + box.height - 5}px,0)`;
  };
  const scan = () => {
    frame = 0;
    const elements = document.querySelectorAll(
      ".project-card,.study-task,.study-course-choice,.study-trial-summary,.settings-section,.card-detail-page,.assistant-message,.assistant-panel,.new-project-form,.card-editor,.card-detail-panel,.page-navigation,.study-trial-panel",
    );
    let count = 0;
    for (const el of elements) {
      if (seen.has(el)) continue;
      seen.add(el);
      if (count++ < 100) inView.observe(el);
    }
    positionBeacon();
  };
  const queueScan = () => {
    if (!frame) frame = requestAnimationFrame(scan);
  };
  const observer = new MutationObserver(queueScan);
  observer.observe(document.body, { childList: true, subtree: true });
  const transition = () => {
    if (document.hidden || document.querySelector("dialog[open]")) return;
    cut.getAnimations({ subtree: true }).forEach((a) => a.cancel());
    play(
      cut,
      [
        { opacity: 0, transform: "scaleX(.15)" },
        { opacity: 0.8, offset: 0.25 },
        { opacity: 0, transform: "scaleX(1.6)" },
      ],
      { duration: dramatic ? 850 : 300, easing: "cubic-bezier(.22,1,.36,1)" },
    );
    document.documentElement.dataset.sceneChanging = "true";
    clearTimeout(routeTimer);
    routeTimer = window.setTimeout(
      () => delete document.documentElement.dataset.sceneChanging,
      dramatic ? 850 : 300,
    );
    queueScan();
  };
  const press = (event: PointerEvent) => {
    if (
      !preference.interactions ||
      event.button !== 0 ||
      document.hidden ||
      !event.isTrusted
    )
      return;
    const target =
      event.target instanceof Element
        ? event.target.closest("button,a[href],summary,[role=tab]")
        : null;
    if (
      !target ||
      target.matches(":disabled,[aria-disabled=true]") ||
      target.closest(".auth-arrival")
    )
      return;
    const ring = document.createElement("span");
    ring.className = "scene-press-ring";
    ring.style.left = `${event.clientX}px`;
    ring.style.top = `${event.clientY}px`;
    layer.append(ring);
    const animation = play(
      ring,
      [
        { opacity: 0.7, transform: "translate(-50%,-50%) scale(.1)" },
        {
          opacity: 0,
          transform: `translate(-50%,-50%) scale(${dramatic ? 1.5 : 0.8})`,
        },
      ],
      { duration: dramatic ? 650 : 280, easing: "cubic-bezier(.16,1,.3,1)" },
    );
    animation.finished.catch(() => {}).finally(() => ring.remove());
    // A bounded burst, even on rapid multi-touch.
    while (layer.querySelectorAll(".scene-press-ring").length > 6)
      layer.querySelector(".scene-press-ring")?.remove();
    if (target.closest(".mobile-bottom-navigation")) {
      clearTimeout(burstTimer);
      layer.dataset.navBurst = "true";
      burstTimer = window.setTimeout(() => delete layer.dataset.navBurst, 650);
    }
  };
  const visibility = () => {
    layer.hidden = document.hidden;
    if (document.hidden) animations.forEach((a) => a.cancel());
  };
  window.addEventListener("hashchange", transition);
  window.addEventListener("resize", queueScan);
  window.visualViewport?.addEventListener("resize", queueScan);
  document.addEventListener("pointerdown", press, { passive: true });
  document.addEventListener("visibilitychange", visibility);
  scan();
  return () => {
    cancelSceneTransition();
    observer.disconnect();
    inView.disconnect();
    cancelAnimationFrame(frame);
    clearTimeout(routeTimer);
    clearTimeout(burstTimer);
    animations.forEach((a) => a.cancel());
    layer.remove();
    delete document.documentElement.dataset.sceneChanging;
    window.removeEventListener("hashchange", transition);
    window.removeEventListener("resize", queueScan);
    window.visualViewport?.removeEventListener("resize", queueScan);
    document.removeEventListener("pointerdown", press);
    document.removeEventListener("visibilitychange", visibility);
  };
}

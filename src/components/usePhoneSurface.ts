import { useLayoutEffect, useSyncExternalStore } from "react";
import type { RefObject } from "react";
const query = "(max-width: 600px)";
const subscribe = (change: () => void) => {
  if (!window.matchMedia) return () => {};
  const media = matchMedia(query);
  media.addEventListener("change", change);
  return () => media.removeEventListener("change", change);
};
export const usePhoneLayout = () =>
  useSyncExternalStore(
    subscribe,
    () => window.matchMedia?.(query).matches ?? false,
    () => false,
  );
/** Keep one phone editing surface focused without remounting its draft. */
export function usePhoneSurface(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
) {
  useLayoutEffect(() => {
    const node = ref.current;
    if (!active || !node) return;
    const body = document.body,
      scrollY = window.scrollY;
    const previous = {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
    };
    const hidden: Array<[HTMLElement, boolean]> = [];
    body.style.overflow = "hidden";
    const previousSurface =
      document.documentElement.getAttribute("data-phone-surface");
    document.documentElement.setAttribute("data-phone-surface", "on");
    let branch: HTMLElement = node;
    while (branch.parentElement && branch !== body) {
      for (const sibling of branch.parentElement.children)
        if (sibling !== branch && sibling instanceof HTMLElement) {
          hidden.push([sibling, sibling.inert]);
          sibling.setAttribute("inert", "");
        }
      branch = branch.parentElement;
    }
    let frame = 0;
    const paint = () => {
      frame = 0;
      const view = window.visualViewport;
      node.style.setProperty(
        "--phone-height",
        (view?.height || innerHeight) + "px",
      );
      node.style.setProperty("--phone-top", (view?.offsetTop || 0) + "px");
    };
    const update = () => {
      if (!frame) frame = requestAnimationFrame(paint);
    };
    paint();
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
      if (
        node.contains(document.activeElement) &&
        document.activeElement instanceof HTMLElement
      )
        document.activeElement.blur();
      for (const [element, inert] of hidden)
        element.toggleAttribute("inert", inert);
      Object.assign(body.style, previous);
      if (previousSurface === null)
        document.documentElement.removeAttribute("data-phone-surface");
      else
        document.documentElement.setAttribute(
          "data-phone-surface",
          previousSurface,
        );
      node.style.removeProperty("--phone-height");
      node.style.removeProperty("--phone-top");
      window.scrollTo({ top: scrollY, behavior: "instant" });
    };
  }, [ref, active]);
}

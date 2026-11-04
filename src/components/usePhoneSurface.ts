import { useEffect, useSyncExternalStore } from "react";
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
  useEffect(() => {
    const node = ref.current;
    if (!active || !node) return;
    const overflow = document.body.style.overflow,
      scrollY = window.scrollY,
      hidden: Array<[HTMLElement, boolean]> = [];
    document.body.style.overflow = "hidden";
    let branch: HTMLElement = node;
    while (branch.parentElement && branch !== document.body) {
      for (const sibling of branch.parentElement.children)
        if (sibling !== branch && sibling instanceof HTMLElement) {
          hidden.push([sibling, sibling.inert]);
          sibling.setAttribute("inert", "");
        }
      branch = branch.parentElement;
    }
    return () => {
      for (const [element, inert] of hidden)
        element.toggleAttribute("inert", inert);
      document.body.style.overflow = overflow;
      requestAnimationFrame(() =>
        window.scrollTo({ top: scrollY, behavior: "instant" }),
      );
    };
  }, [ref, active]);
}

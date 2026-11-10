import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction, RefObject } from "react";
import type { JourneyStep } from "./journeySession";
import { journeyCompanionPosition, journeyFocusRect } from "./tourGeometry";
import type { TourRect } from "./tourGeometry";
export type JourneyCue =
  | "create"
  | "name"
  | "next"
  | "save"
  | "card"
  | "reminder"
  | "university"
  | "groups";
/** Browser geometry only. The guide observes actual controls without creating or submitting data. */
export function useJourneyGuide(
  active: boolean,
  step: JourneyStep,
  targetId: string | undefined,
  minimized: boolean,
  onOpened: Dispatch<SetStateAction<boolean>>,
  coach: RefObject<HTMLElement | null>,
) {
  const [compact, setCompact] = useState(false);
  const [host, setHost] = useState<HTMLElement>(() => document.body),
    [focus, setFocus] = useState<TourRect | null>(null),
    [cue, setCue] = useState<JourneyCue>("create"),
    [position, setPosition] = useState({
      x: 12,
      y: 12,
      width: 320,
      height: 220,
    });
  useEffect(() => {
    if (!active) return;
    let frame = 0,
      target: HTMLElement | null = null;
    const paint = () => {
      frame = 0;
      const phoneSurface = document.querySelector<HTMLElement>(
        ".phone-form-fullscreen,.phone-card-fullscreen",
      );
      const dialog = document.querySelector<HTMLElement>("dialog[open]");
      const nextHost = dialog || phoneSurface || document.body;
      setHost((current) => (current === nextHost ? current : nextHost));
      let node: HTMLElement | null = null,
        nextCue: JourneyCue = "create";
      const form = document.querySelector<HTMLFormElement>(".new-project-form");
      if (step === "create" && form) {
        const name = form.querySelector<HTMLInputElement>("#project-name"),
          next = form.querySelector<HTMLTextAreaElement>("#project-next-step"),
          focused = document.activeElement;
        if (!name?.value.trim() || focused === name) {
          node = name;
          nextCue = "name";
        } else if (!next?.value.trim()) {
          node = next;
          nextCue = "next";
        } else {
          node = form.querySelector('[data-tour="save-project"]');
          nextCue = "save";
        }
      } else if (step === "create")
        node = document.querySelector('[data-tour="add-project"]');
      else if (step === "card") {
        const card = document.querySelector<HTMLElement>(
          `[data-project="${CSS.escape(targetId || "")}"]`,
        );
        if (card?.matches(".card-detail-panel")) {
          onOpened(true);
          node = card.querySelector(".card-reminder-trigger");
          nextCue = "reminder";
        } else {
          node = card?.querySelector(".envelope-expand") || card || null;
          nextCue = "card";
        }
      } else if (step === "university") {
        node = document.querySelector(".study-toolbar button,.study-toolbar");
        nextCue = "university";
      } else if (step === "groups") {
        node = document.querySelector(".group-create summary,.group-spaces");
        nextCue = "groups";
      }
      if (target !== node) {
        target?.removeAttribute("data-journey-target");
        target = node;
        target?.setAttribute("data-journey-target", "true");
      }
      setCue(nextCue);
      const viewport = window.visualViewport,
        offset = { x: viewport?.offsetLeft || 0, y: viewport?.offsetTop || 0 },
        view = {
          width: viewport?.width || innerWidth,
          height: viewport?.height || innerHeight,
        };
      setCompact(view.height < 500);
      const rect = node?.getBoundingClientRect();
      const clipped = journeyFocusRect(
        rect
          ? {
              x: rect.x - offset.x,
              y: rect.y - offset.y,
              width: rect.width,
              height: rect.height,
            }
          : null,
        view,
      );
      const nextFocus = clipped
        ? { ...clipped, x: clipped.x + offset.x, y: clipped.y + offset.y }
        : null;
      setFocus((previous) =>
        JSON.stringify(previous) === JSON.stringify(nextFocus)
          ? previous
          : nextFocus,
      );
      const size = coach.current?.getBoundingClientRect();
      const cardRect = node
        ?.closest(".project-card:not(.card-detail-panel)")
        ?.getBoundingClientRect();
      const nextPosition = journeyCompanionPosition(
        clipped,
        view,
        {
          width: Math.min(minimized ? 110 : 320, view.width - 24),
          height: size?.height || 220,
        },
        cardRect
          ? {
              x: cardRect.x - offset.x,
              y: cardRect.y - offset.y,
              width: cardRect.width,
              height: cardRect.height,
            }
          : null,
      );
      nextPosition.x += offset.x;
      nextPosition.y += offset.y;
      setPosition((previous) =>
        JSON.stringify(previous) === JSON.stringify(nextPosition)
          ? previous
          : nextPosition,
      );
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(paint);
    };
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class", "open"],
    });
    const resize =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(schedule)
        : null;
    if (coach.current) resize?.observe(coach.current);
    document.addEventListener("focusin", schedule);
    document.addEventListener("input", schedule);
    document.addEventListener("change", schedule);
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    window.visualViewport?.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("scroll", schedule);
    paint();
    return () => {
      observer.disconnect();
      resize?.disconnect();
      cancelAnimationFrame(frame);
      target?.removeAttribute("data-journey-target");
      document.removeEventListener("focusin", schedule);
      document.removeEventListener("input", schedule);
      document.removeEventListener("change", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
      window.visualViewport?.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("scroll", schedule);
    };
  }, [active, step, targetId, minimized, onOpened, host, coach]);
  return { host, focus, cue, position, compact };
}

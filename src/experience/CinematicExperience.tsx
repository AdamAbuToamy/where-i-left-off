import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { isAdmin } from "../lib/admin";
import { InteractionAudio } from "./interactionAudio";
import { experienceEvent, readExperience } from "./preferences";
import type { ExperiencePreferences } from "./preferences";
import "./cinematic.css";
export default function CinematicExperience({ user }: { user: User | null }) {
  const uid = user?.uid || "",
    allowed = !!user && isAdmin(user.email, user.emailVerified);
  const [preference, setPreference] = useState(() => readExperience(uid));
  useEffect(() => {
    const changed = (event: Event) => {
      const detail = (
        event as CustomEvent<{ uid: string; value: ExperiencePreferences }>
      ).detail;
      if (detail?.uid === uid) setPreference(detail.value);
    };
    window.addEventListener(experienceEvent, changed);
    return () => window.removeEventListener(experienceEvent, changed);
  }, [uid]);
  useEffect(() => {
    if (!allowed) return;
    document.documentElement.dataset.cinematic = preference.motion
      ? "on"
      : "off";
    return () => {
      delete document.documentElement.dataset.cinematic;
    };
  }, [allowed, preference.motion]);
  useEffect(() => {
    if (!allowed || !preference.sound) return;
    const audio = new InteractionAudio();
    let drag: { x: number; y: number } | null = null;
    const click = (event: MouseEvent) => {
      if (!event.isTrusted || document.hidden) return;
      const element =
        event.target instanceof Element
          ? event.target.closest("button,a[href],summary,[role=tab]")
          : null;
      if (
        !element ||
        element.closest("[data-sound-control],:disabled,[aria-disabled=true]")
      )
        return;
      void audio.play(element.matches("a[href^='#/']") ? "navigate" : "press");
    };
    const down = (event: PointerEvent) => {
      if (
        event.isTrusted &&
        event.target instanceof Element &&
        event.target.closest(".drag-handle,.plan-node-grip")
      )
        drag = { x: event.clientX, y: event.clientY };
    };
    const up = (event: PointerEvent) => {
      if (
        drag &&
        Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 12
      )
        void audio.play("drop");
      drag = null;
    };
    const cancel = () => {
      drag = null;
    };
    const change = (event: Event) => {
      if (
        event.isTrusted &&
        !document.hidden &&
        event.target instanceof Element &&
        event.target.matches("select,input[type=checkbox],input[type=radio]") &&
        !event.target.closest("[data-sound-control],:disabled")
      )
        void audio.play("press");
    };
    document.addEventListener("click", click, true);
    document.addEventListener("change", change, true);
    document.addEventListener("pointerdown", down, true);
    document.addEventListener("pointerup", up, true);
    document.addEventListener("pointercancel", cancel, true);
    return () => {
      audio.dispose();
      document.removeEventListener("click", click, true);
      document.removeEventListener("change", change, true);
      document.removeEventListener("pointerdown", down, true);
      document.removeEventListener("pointerup", up, true);
      document.removeEventListener("pointercancel", cancel, true);
    };
  }, [allowed, preference.sound]);
  return null;
}

import { cancelEntryAudio } from "./entryAudio";
import { installSceneMotion } from "./sceneMotion";
import ArrivalScene from "./ArrivalScene";
import { takeAuthArrival } from "../lib/authEntry";
import type { Language } from "../translations";
import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { isAdmin } from "../lib/admin";
import { InteractionAudio } from "./interactionAudio";
import { experienceEvent, readExperience } from "./preferences";
import type { ExperiencePreferences } from "./preferences";
import "./cinematic.css";
export default function CinematicExperience({
  user,
  language,
}: {
  user: User | null;
  language: Language;
}) {
  const uid = user?.uid || "",
    allowed = !!user && isAdmin(user.email, user.emailVerified);
  const [preference, setPreference] = useState(() => readExperience(uid));
  const [arrival, setArrival] = useState(() => {
    const requested = takeAuthArrival(uid);
    return (
      requested &&
      allowed &&
      readExperience(uid).motion &&
      !matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  });
  useEffect(() => {
    if (!allowed || !arrival || !preference.sound) cancelEntryAudio();
  }, [allowed, arrival, preference.sound]);
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
    document.documentElement.dataset.motionIntensity = preference.intensity;
    document.documentElement.dataset.motionInteractions =
      preference.interactions ? "on" : "off";
    return () => {
      delete document.documentElement.dataset.cinematic;
      delete document.documentElement.dataset.motionIntensity;
      delete document.documentElement.dataset.motionInteractions;
    };
  }, [
    allowed,
    preference.motion,
    preference.intensity,
    preference.interactions,
  ]);
  useEffect(() => {
    if (!allowed || !preference.motion) return;
    return installSceneMotion(preference);
  }, [allowed, preference]);
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
  return (
    <>
      {allowed && arrival && preference.motion && (
        <ArrivalScene
          language={language}
          sound={preference.sound}
          intensity={preference.intensity}
          onComplete={() => setArrival(false)}
        />
      )}
    </>
  );
}

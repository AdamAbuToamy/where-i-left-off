import { useEffect, useRef } from "react";
import { InteractionAudio } from "../experience/interactionAudio";
import { readExperience, experienceEvent } from "../experience/preferences";
/** Short, gesture-unlocked cues through Wilo's existing audio boundary. Never speak or fetch media. */
export function useJourneyAudio(uid: string, active: boolean, cue: string) {
  const audio = useRef<InteractionAudio | null>(null),
    unlocked = useRef(false),
    lastCue = useRef("");
  useEffect(() => {
    if (!active) return;
    const silence = () => {
      audio.current?.dispose();
      audio.current = null;
      unlocked.current = false;
    };
    const unlock = () => {
      if (!readExperience(uid).sound || document.hidden) return;
      const player = (audio.current ||= new InteractionAudio());
      void player.unlock().then((ok) => {
        if (audio.current === player) unlocked.current = ok;
      });
    };
    const preferences = () => {
      if (!readExperience(uid).sound) silence();
    };
    document.addEventListener("pointerdown", unlock, true);
    document.addEventListener("keydown", unlock, true);
    window.addEventListener(experienceEvent, preferences);
    return () => {
      document.removeEventListener("pointerdown", unlock, true);
      document.removeEventListener("keydown", unlock, true);
      window.removeEventListener(experienceEvent, preferences);
      silence();
      lastCue.current = "";
    };
  }, [uid, active]);
  useEffect(() => {
    if (!active || cue === lastCue.current) return;
    lastCue.current = cue;
    if (unlocked.current && readExperience(uid).sound && !document.hidden)
      void audio.current?.play("guide");
  }, [uid, active, cue]);
}

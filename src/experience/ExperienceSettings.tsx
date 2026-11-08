import { useEffect, useId, useRef, useState } from "react";
import { Volume2, VolumeX, Clapperboard } from "lucide-react";
import type { Language } from "../translations";
import { readExperience, saveExperience, experienceEvent } from "./preferences";
import { InteractionAudio } from "./interactionAudio";
export default function ExperienceSettings({
  uid,
  language,
}: {
  uid: string;
  language: Language;
}) {
  const [value, setValue] = useState(() => readExperience(uid));
  const soundHintId = useId();
  const preview = useRef<InteractionAudio | null>(null);
  useEffect(
    () => () => {
      preview.current?.dispose();
      preview.current = null;
    },
    [value.sound],
  );
  const words = {
    ar: {
      title: "الحركة والصوت",
      sound: "أصوات التفاعل",
      phoneHint:
        "أصوات الواجهة تتحكم بها يدويًا لكل جهاز. وضع الهاتف الصامت قد لا يكتم أصوات المتصفح. لا يؤثر هذا الخيار على الإشعارات.",
      motion: "الانتقالات السينمائية",
      test: "جرّب الصوت",
    },
    en: {
      title: "Motion & sound",
      sound: "Interaction sounds",
      phoneHint:
        "Control interface sounds manually for each device. Your phone’s silent mode may not mute browser audio. This does not change notification sounds.",
      motion: "Cinematic transitions",
      test: "Preview sound",
    },
    he: {
      title: "תנועה וצליל",
      sound: "צלילי ממשק",
      phoneHint:
        "שליטה ידנית בצלילי הממשק לכל מכשיר. מצב שקט בטלפון עשוי לא להשתיק את הדפדפן. ההגדרה אינה משנה צלילי התראות.",
      motion: "מעברים קולנועיים",
      test: "בדיקת צליל",
    },
  }[language];
  useEffect(() => {
    const update = (event: Event) => {
      const detail = (
        event as CustomEvent<{ uid: string; value: typeof value }>
      ).detail;
      if (detail?.uid === uid) setValue(detail.value);
    };
    window.addEventListener(experienceEvent, update);
    return () => window.removeEventListener(experienceEvent, update);
  }, [uid]);
  const change = (patch: Partial<typeof value>) => {
    const next = { ...value, ...patch };
    setValue(next);
    saveExperience(uid, next);
  };
  return (
    <section
      className="settings-section experience-settings"
      data-sound-control
    >
      <h3>
        <Clapperboard size={19} />
        {words.title}
      </h3>
      <label>
        <input
          type="checkbox"
          aria-describedby={soundHintId}
          checked={value.sound}
          onChange={(event) => change({ sound: event.target.checked })}
        />
        {value.sound ? <Volume2 size={18} /> : <VolumeX size={18} />}{" "}
        {words.sound}
      </label>
      <label>
        <input
          type="checkbox"
          checked={value.motion}
          onChange={(event) => change({ motion: event.target.checked })}
        />
        {words.motion}
      </label>
      <p id={soundHintId}>{words.phoneHint}</p>
      <button
        type="button"
        className="secondary-button"
        disabled={!value.sound}
        onClick={() => {
          preview.current?.dispose();
          const audio = new InteractionAudio();
          preview.current = audio;
          void audio.play("navigate");
          setTimeout(() => {
            audio.dispose();
            if (preview.current === audio) preview.current = null;
          }, 300);
        }}
      >
        {words.test}
      </button>
    </section>
  );
}

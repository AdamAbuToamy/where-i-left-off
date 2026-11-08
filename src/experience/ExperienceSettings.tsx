import { useEffect, useState } from "react";
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
  const words = {
    ar: {
      title: "الحركة والصوت",
      sound: "أصوات التفاعل",
      motion: "الانتقالات السينمائية",
      intensity: "أسلوب الحركة",
      dramatic: "سينمائي — حركة كاملة",
      calm: "هادئ — حركة مختصرة",
      ambient: "أجواء الخلفية المتحركة",
      interactions: "تأثيرات الضغط والتفاعل",
      reduced: "إعداد تقليل الحركة في جهازك له الأولوية دائمًا.",
      test: "جرّب الصوت",
      hint: "إعدادات تجربة الإدارة على هذا الجهاز. يمكنك إيقافها في أي وقت.",
    },
    en: {
      title: "Motion & sound",
      sound: "Interaction sounds",
      motion: "Cinematic transitions",
      intensity: "Motion style",
      dramatic: "Cinematic — full choreography",
      calm: "Calm — short transitions",
      ambient: "Ambient background motion",
      interactions: "Press and interaction effects",
      reduced: "Your device’s Reduce Motion setting always takes priority.",
      test: "Preview sound",
      hint: "Admin preview preferences on this device. Turn them off at any time.",
    },
    he: {
      title: "תנועה וצליל",
      sound: "צלילי ממשק",
      motion: "מעברים קולנועיים",
      intensity: "סגנון התנועה",
      dramatic: "קולנועי — תנועה מלאה",
      calm: "רגוע — מעברים קצרים",
      ambient: "תנועת רקע",
      interactions: "אפקטים של לחיצה ואינטראקציה",
      reduced: "הגדרת הפחתת התנועה במכשיר קודמת תמיד.",
      test: "בדיקת צליל",
      hint: "העדפות תצוגת המנהל במכשיר הזה. ניתן לכבות בכל עת.",
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
      <fieldset disabled={!value.motion} className="experience-motion-options">
        <label>
          {words.intensity}
          <select
            aria-label={words.intensity}
            value={value.intensity}
            onChange={(event) =>
              change({
                intensity: event.target.value === "calm" ? "calm" : "dramatic",
              })
            }
          >
            <option value="dramatic">{words.dramatic}</option>
            <option value="calm">{words.calm}</option>
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={value.ambient}
            onChange={(event) => change({ ambient: event.target.checked })}
          />
          {words.ambient}
        </label>
        <label>
          <input
            type="checkbox"
            checked={value.interactions}
            onChange={(event) => change({ interactions: event.target.checked })}
          />
          {words.interactions}
        </label>
      </fieldset>
      <p>{words.hint}</p>
      <p className="experience-reduced-hint">{words.reduced}</p>
      <button
        type="button"
        className="secondary-button"
        disabled={!value.sound}
        onClick={() => {
          const audio = new InteractionAudio();
          void audio.play("navigate");
          setTimeout(() => audio.dispose(), 300);
        }}
      >
        {words.test}
      </button>
    </section>
  );
}

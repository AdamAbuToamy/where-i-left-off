import { useState } from "react";
import type { Language } from "../translations";
import { useExperience } from "./context";
import CardPicker from "./CardPicker";
import { label } from "./helpers";
import { Panel } from "./ui";
export default function AssistantPanel({
  language,
  selected = "",
}: {
  language: Language;
  selected?: string;
}) {
  const context = useExperience()!,
    [card, setCard] = useState(selected),
    t = (a: string, e: string) => label(language, a, e);
  return (
    <Panel title={t("مساعد يعرف سياق الشاشة", "Assistant with screen context")}>
      <p>
        {t(
          "افتح البطاقة أو الكورس ثم اطلب من ويلو التعديل. المرجع المفتوح يُطابق مع بيانات الحساب قبل إرساله، ويظهر في الرد.",
          "Open a card or course, then ask Wilo to change it. The open reference is checked against account data and shown in the reply.",
        )}
      </p>
      <CardPicker
        value={card}
        onChange={setCard}
        language={language}
        title={t("بطاقة لتجربتها", "Card to try")}
      />
      {card && (
        <a href={"#/personal/" + card.split("/")[1]}>
          {t(
            "فتح البطاقة ثم استخدام المساعد",
            "Open the card, then use the assistant",
          )}{" "}
          ↗
        </a>
      )}
      <details>
        <summary>{t("ما الذي ينفذه الآن؟", "What can it execute?")}</summary>
        <p>
          {t(
            "تعديلات البطاقات والأقسام والكورسات والمهام والمحاضرات والإعدادات المدعومة، مع مراجعة قبل الحفظ وتراجع حيث يتوفر. يحتفظ بتفاصيل المسودة خلال أسئلة المتابعة.",
            "Supported card, section, course, task, lesson and settings changes, with review before saving and undo where available. Draft details remain available through follow-up questions.",
          )}
        </p>
      </details>
      <details>
        <summary>{t("حدود أدوات التجربة", "Preview tool limits")}</summary>
        <p>
          {t(
            "الوارد وأوقات العمل والدرجات وسجل النسخ والقوالب والألواح تستخدم أزرارها الحالية. لا يملك المساعد دوال تنفيذ لهذه الإضافات بعد، ويجب أن يوضح ذلك بدل الادعاء بالتنفيذ.",
            "Inbox, work-time blocks, grades, version history, templates and boards use their own UI. The assistant has no mutation executors for these additions yet and must say so rather than claim execution.",
          )}
        </p>
      </details>
      <span hidden>{context.uid}</span>
    </Panel>
  );
}

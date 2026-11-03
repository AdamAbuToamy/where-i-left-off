import { Check, CloudOff, HardDrive, Info, LoaderCircle } from "lucide-react";
import type { Language } from "../translations";

type SyncKind = "saving" | "offline" | "cached" | "saved";
const icons = {
  saving: LoaderCircle,
  offline: CloudOff,
  cached: HardDrive,
  saved: Check,
};
const words = {
  ar: {
    saving: "يحفظ…",
    offline: "دون اتصال",
    cached: "محلي",
    saved: "محفوظ",
    details: "تفاصيل المزامنة",
  },
  en: {
    saving: "Saving…",
    offline: "Offline",
    cached: "Local",
    saved: "Saved",
    details: "Sync details",
  },
  he: {
    saving: "שומר…",
    offline: "לא מקוון",
    cached: "מקומי",
    saved: "נשמר",
    details: "פרטי סנכרון",
  },
};
/** Only presentation is condensed. Full offline/queue information stays available. */
export default function KitchenSyncStatus({
  kind,
  detail,
  language,
}: {
  kind: SyncKind;
  detail: string;
  language: Language;
}) {
  const Icon = icons[kind],
    text = words[language];
  return (
    <div className={`sync-status kitchen-sync is-${kind}`}>
      <span role="status" aria-label={detail}>
        <Icon size={14} aria-hidden="true" />
        <span>{text[kind]}</span>
      </span>
      <details>
        <summary aria-label={text.details}>
          <Info size={15} aria-hidden="true" />
        </summary>
        <p>{detail}</p>
      </details>
    </div>
  );
}

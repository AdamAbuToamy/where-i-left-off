import { transcriptionWords } from "./transcriptionWords";
import { SESSION_SPEECH_MODEL } from "./speechModel";
import type { Language } from "../translations";
const en = {
  title: "Session assistant",
  actions: {
    add_item: "Add checklist item",
    edit_item: "Edit checklist item",
    complete_item: "Complete item",
    reopen_item: "Reopen item",
    delete_item: "Delete item",
    add_note: "Add note",
    edit_note: "Edit note",
    delete_note: "Delete note",
    undo: "Undo last voice change",
  },
  private: `Audio is processed on this device and is not recorded. First use downloads multilingual ${SESSION_SPEECH_MODEL.label} (about ${SESSION_SPEECH_MODEL.downloadMegabytes} MB plus a 27 MB runtime); the browser may evict its cache.`,
  start: "Start listening",
  pause: "Pause microphone",
  stop: "Stop and release model",
  off: "Microphone off",
  loading: "Preparing local speech model",
  listening: "Listening locally",
  processing: "Transcribing on this device",
  paused: "Listening paused",
  error: "Voice is unavailable; manual controls remain available.",
  microphone: "Microphone active",
  language: "Speech language",
  automatic: "Suggest notes automatically",
  retention: "Save complete final transcripts to my account",
  retentionHint:
    "Off by default. Turning this off removes saved transcripts and note source quotations; accepted notes remain.",
  sharing:
    "Allow my cloud assistant to read this session checklist and accepted note excerpts",
  sharingHint:
    "Optional. Session voice stays local. When you use the text assistant, the selected session content can be sent to your connected provider. Audio and full transcripts are never shared.",
  transcript: "Final transcript — correct it before applying",
  partial: "Draft transcription",
  analyze: "Understand this text",
  asNote: "Propose as a note",
  apply: "Apply proposal",
  cancel: "Cancel",
  proposal: "Proposal",
  voiceConfirm: "Voice confirmation: confirm proposal",
  ambiguous: "Choose the exact item",
  missing:
    "No matching item. Correct the transcript or choose the item manually.",
  stale:
    "The session changed while this was spoken. Review the current list and analyze the corrected text again.",
  speechOnly:
    "No direct command recognized. You can edit the text or propose it as a note.",
  remaining: "Remaining items",
  none: "No remaining items.",
  notes: "Session notes",
  checklist: "Session checklist",
  add: "Add",
  save: "Save",
  remove: "Delete",
  item: "Item text",
  note: "Note text",
  drafts: "Suggested notes — not saved",
  draftLimit: "Review these 10 drafts before more suggestions can be added.",
  accept: "Accept note",
  reject: "Reject",
  undo: "Undo last voice change",
  local: "Saved on this device · synchronization pending",
  synced: "Saved to your account",
  failed: "Could not save. Your accepted local changes remain on this device.",
  conflict:
    "This session was edited elsewhere. Choose which version to keep; nothing is overwritten automatically.",
  keepLocal: "Keep my local version",
  keepRemote: "Use account version",
  confirmRemote:
    "Replace your local pending session edits with the account version?",
  retry: "Retry synchronization",
  privacy: "Privacy and local processing",
  permission:
    "Microphone permission was denied. Allow it in browser settings or use manual input.",
  noDevice: "No microphone was found. Connect one or use manual input.",
  unsupported:
    "Local audio processing is unsupported in this browser or context. Use HTTPS and a supported browser, or continue manually.",
  modelError:
    "Could not load the local speech model. Check the connection and available storage, then retry. No cloud fallback was used.",
  busy: "Another local model is using the device. Stop it before enabling voice.",
  backlog:
    "Transcription fell behind. Listening was stopped; saved edits are safe. Resume after reviewing the last transcript.",
  capacity:
    "This session reached its storage limit. Start a new session; no existing content was discarded.",
  undoConflict: "A newer edit prevents safe undo. No changes were overwritten.",
  ready: "Connecting session storage",
  connected: "Ready",
  older: "Show older sessions",
  history: "Saved session notes",
  closed: "Completed session",
  confirmNumber: "Confirmation does not match the visible proposal.",
  duplicate: "This segment has already been handled.",
  saved: "Change saved",
  edit: "Edit",
  speakClear:
    "Choose Arabic, Hebrew or English. Dialect, noise and mixed technical words may need transcript correction.",
};
const ar: typeof en = {
  title: "مساعد الجلسة",
  actions: {
    add_item: "إضافة بند",
    edit_item: "تعديل بند",
    complete_item: "إكمال بند",
    reopen_item: "إعادة فتح بند",
    delete_item: "حذف بند",
    add_note: "إضافة ملاحظة",
    edit_note: "تعديل ملاحظة",
    delete_note: "حذف ملاحظة",
    undo: "تراجع عن آخر تعديل صوتي",
  },
  private: `يُعالج الصوت على جهازك ولا يُسجّل. أول استخدام ينزّل ${SESSION_SPEECH_MODEL.label} متعدد اللغات (نحو ${SESSION_SPEECH_MODEL.downloadMegabytes} ميجابايت مع 27 ميجابايت للتشغيل)؛ قد يمسح المتصفح التخزين المؤقت.`,
  start: "تشغيل الاستماع",
  pause: "إيقاف الميكروفون مؤقتًا",
  stop: "إنهاء الصوت وتحرير النموذج",
  off: "الميكروفون متوقف",
  loading: "تجهيز نموذج الصوت المحلي",
  listening: "أستمع محليًا",
  processing: "تفريغ الصوت على جهازك",
  paused: "الاستماع متوقف مؤقتًا",
  error: "تعذّر الصوت؛ التحكم اليدوي متاح.",
  microphone: "الميكروفون يعمل",
  language: "لغة الكلام",
  automatic: "اقتراح ملاحظات تلقائيًا",
  retention: "حفظ التفريغ النهائي الكامل في حسابي",
  retentionHint:
    "معطّل افتراضيًا. إيقافه يمسح التفريغ واقتباسات المصدر المحفوظة؛ الملاحظات المقبولة تبقى.",
  sharing:
    "السماح للمساعد السحابي بقراءة قائمة هذه الجلسة ومقتطفات الملاحظات المقبولة",
  sharingHint:
    "اختياري. صوت الجلسة يبقى محليًا. عند استخدام المساعد النصي يمكن إرسال محتوى الجلسة المحدد إلى مزودك المرتبط. لا يُرسل الصوت أو التفريغ الكامل.",
  transcript: "النص النهائي — صحّحه قبل التطبيق",
  partial: "تفريغ جارٍ",
  analyze: "فهم هذا النص",
  asNote: "اقتراحه كملاحظة",
  apply: "تطبيق المقترح",
  cancel: "إلغاء",
  proposal: "اقتراح",
  voiceConfirm: "للتأكيد الصوتي: نفذ اقتراح",
  ambiguous: "اختر البند المقصود تحديدًا",
  missing: "لم أجد بندًا مطابقًا. صحّح النص أو اختر البند يدويًا.",
  stale:
    "تغيّرت الجلسة أثناء الكلام. راجع القائمة الحالية ثم افهم النص المصحح من جديد.",
  speechOnly: "لم أتعرف على أمر مباشر. يمكنك تعديل النص أو اقتراحه كملاحظة.",
  remaining: "البنود المتبقية",
  none: "لا توجد بنود متبقية.",
  notes: "ملاحظات الجلسة",
  checklist: "قائمة الجلسة",
  add: "إضافة",
  save: "حفظ",
  remove: "حذف",
  item: "نص البند",
  note: "نص الملاحظة",
  drafts: "ملاحظات مقترحة — غير محفوظة",
  draftLimit: "راجع المسودات العشر الحالية قبل إضافة اقتراحات جديدة.",
  accept: "قبول الملاحظة",
  reject: "رفض",
  undo: "تراجع عن آخر تعديل صوتي",
  local: "محفوظ على الجهاز · بانتظار المزامنة",
  synced: "محفوظ في حسابك",
  failed: "تعذّر الحفظ. التعديلات المقبولة المحفوظة محليًا تبقى على جهازك.",
  conflict:
    "عُدلت الجلسة من مكان آخر. اختر النسخة التي تريدها؛ لا نستبدل التعديلات تلقائيًا.",
  keepLocal: "الاحتفاظ بنسختي المحلية",
  keepRemote: "استخدام نسخة الحساب",
  confirmRemote: "استبدال تعديلات الجلسة المحلية المنتظرة بنسخة الحساب؟",
  retry: "إعادة المزامنة",
  privacy: "الخصوصية والمعالجة المحلية",
  permission:
    "رُفض إذن الميكروفون. اسمح به من إعدادات المتصفح أو استخدم الإدخال اليدوي.",
  noDevice: "لم أجد ميكروفونًا. صِل واحدًا أو استخدم الإدخال اليدوي.",
  unsupported:
    "المعالجة الصوتية المحلية غير مدعومة في هذا المتصفح أو السياق. استخدم HTTPS ومتصفحًا مدعومًا، أو أكمل يدويًا.",
  modelError:
    "تعذّر تحميل نموذج الصوت المحلي. تحقق من الاتصال والمساحة ثم أعد المحاولة. لم ننتقل إلى السحابة.",
  busy: "نموذج محلي آخر يستخدم موارد الجهاز. أوقفه قبل تشغيل الصوت.",
  backlog:
    "تأخر التفريغ، فأوقفنا الاستماع. التعديلات المحفوظة سليمة. راجع آخر نص ثم استأنف.",
  capacity: "بلغت الجلسة حد التخزين. ابدأ جلسة جديدة؛ لم نحذف أي محتوى موجود.",
  undoConflict: "يوجد تعديل أحدث يمنع التراجع الآمن. لم نستبدل أي تعديل.",
  ready: "جارٍ ربط حفظ الجلسة",
  connected: "جاهز",
  older: "إظهار جلسات أقدم",
  history: "ملاحظات جلسة محفوظة",
  closed: "جلسة منتهية",
  confirmNumber: "التأكيد لا يطابق الاقتراح الظاهر.",
  duplicate: "سبق التعامل مع هذا المقطع.",
  saved: "حُفظ التعديل",
  edit: "تعديل",
  speakClear:
    "اختر العربية أو العبرية أو الإنجليزية. اللهجة والضجيج وخلط المصطلحات التقنية قد تحتاج تصحيح النص.",
};
const he: typeof en = {
  title: "עוזר המפגש",
  actions: {
    add_item: "הוספת סעיף",
    edit_item: "עריכת סעיף",
    complete_item: "השלמת סעיף",
    reopen_item: "פתיחה מחדש",
    delete_item: "מחיקת סעיף",
    add_note: "הוספת הערה",
    edit_note: "עריכת הערה",
    delete_note: "מחיקת הערה",
    undo: "ביטול השינוי הקולי האחרון",
  },
  private: `האודיו מעובד במכשיר ואינו מוקלט. בשימוש הראשון מורידים ${SESSION_SPEECH_MODEL.label} רב־לשוני (כ־${SESSION_SPEECH_MODEL.downloadMegabytes} MB ועוד סביבת הרצה של 27 MB); הדפדפן עשוי לפנות את המטמון.`,
  start: "התחלת האזנה",
  pause: "השהיית המיקרופון",
  stop: "סיום ושחרור המודל",
  off: "המיקרופון כבוי",
  loading: "מכינים מודל דיבור מקומי",
  listening: "מאזינים מקומית",
  processing: "מתמללים במכשיר",
  paused: "ההאזנה מושהית",
  error: "הקול אינו זמין; השליטה הידנית זמינה.",
  microphone: "המיקרופון פעיל",
  language: "שפת הדיבור",
  automatic: "הצעת הערות אוטומטית",
  retention: "שמירת התמלילים הסופיים המלאים בחשבון שלי",
  retentionHint:
    "כבוי כברירת מחדל. כיבוי מוחק תמלילים וציטוטי מקור שמורים; הערות שאושרו נשארות.",
  sharing: "לאפשר לעוזר בענן לקרוא את הרשימה וקטעי הערות מאושרות במפגש",
  sharingHint:
    "אופציונלי. הקול נשאר מקומי. בשימוש בעוזר הטקסט אפשר לשלוח את התוכן שנבחר לספק המחובר. אודיו ותמלילים מלאים אינם משותפים.",
  transcript: "תמליל סופי — אפשר לתקן לפני החלה",
  partial: "תמלול זמני",
  analyze: "הבנת הטקסט",
  asNote: "הצעה כהערה",
  apply: "החלת ההצעה",
  cancel: "ביטול",
  proposal: "הצעה",
  voiceConfirm: "אישור קולי: אשר הצעה",
  ambiguous: "בחרו את הסעיף המדויק",
  missing: "לא נמצא סעיף מתאים. תקנו את התמליל או בחרו ידנית.",
  stale: "המפגש השתנה בזמן הדיבור. בדקו את הרשימה ונתחו שוב את הטקסט המתוקן.",
  speechOnly: "לא זוהתה הוראה ישירה. אפשר לתקן או להציע כהערה.",
  remaining: "סעיפים שנותרו",
  none: "אין סעיפים שנותרו.",
  notes: "הערות המפגש",
  checklist: "רשימת המפגש",
  add: "הוספה",
  save: "שמירה",
  remove: "מחיקה",
  item: "טקסט הסעיף",
  note: "טקסט ההערה",
  drafts: "הערות מוצעות — לא נשמרו",
  draftLimit: "בדקו את 10 הטיוטות לפני הוספת הצעות חדשות.",
  accept: "אישור ההערה",
  reject: "דחייה",
  undo: "ביטול השינוי הקולי האחרון",
  local: "נשמר במכשיר · ממתין לסנכרון",
  synced: "נשמר בחשבון",
  failed: "השמירה נכשלה. שינויים מקומיים שנשמרו נשארים במכשיר.",
  conflict: "המפגש נערך במקום אחר. בחרו גרסה; לא מחליפים שינויים אוטומטית.",
  keepLocal: "שמירת הגרסה המקומית",
  keepRemote: "שימוש בגרסת החשבון",
  confirmRemote: "להחליף שינויים מקומיים ממתינים בגרסת החשבון?",
  retry: "ניסיון סנכרון נוסף",
  privacy: "פרטיות ועיבוד מקומי",
  permission: "הרשאת המיקרופון נדחתה. אפשר לאשר בהגדרות או להזין ידנית.",
  noDevice: "לא נמצא מיקרופון. חברו אחד או הזינו ידנית.",
  unsupported:
    "עיבוד אודיו מקומי אינו נתמך בדפדפן או בהקשר הזה. השתמשו ב־HTTPS ובדפדפן נתמך או המשיכו ידנית.",
  modelError:
    "טעינת מודל הדיבור נכשלה. בדקו חיבור ונפח פנוי ונסו שוב. לא בוצע מעבר לענן.",
  busy: "מודל מקומי אחר משתמש במשאבי המכשיר. עצרו אותו לפני הפעלת קול.",
  backlog:
    "התמלול לא עמד בקצב, וההאזנה הופסקה. השינויים שנשמרו בטוחים. בדקו את התמליל האחרון וחדשו.",
  capacity: "המפגש הגיע למגבלת האחסון. התחילו מפגש חדש; תוכן קיים לא נמחק.",
  undoConflict: "עריכה חדשה יותר מונעת ביטול בטוח. לא נדרסו שינויים.",
  ready: "מחברים את אחסון המפגש",
  connected: "מוכן",
  older: "הצגת מפגשים קודמים",
  history: "הערות מפגש שמורות",
  closed: "מפגש שהסתיים",
  confirmNumber: "האישור אינו תואם להצעה המוצגת.",
  duplicate: "המקטע הזה כבר טופל.",
  saved: "השינוי נשמר",
  edit: "עריכה",
  speakClear:
    "בחרו ערבית, עברית או אנגלית. ניב, רעש ומונחים משולבים עשויים לדרוש תיקון תמליל.",
};
export const sessionWords = { ar, en, he } satisfies Record<
  Language,
  typeof en
>;
export function sessionErrorText(code: string, language: Language) {
  const t = sessionWords[language];
  return code === "speech-cache"
    ? language === "ar"
      ? "تعذر حفظ نموذج الصوت على الجهاز. وفر مساحة أو استخدم نافذة متصفح عادية ثم أعد المحاولة."
      : language === "he"
        ? "לא ניתן לשמור את מודל הקול במכשיר. פנו מקום או השתמשו בחלון דפדפן רגיל ונסו שוב."
        : "The speech model could not be saved on this device. Free storage or use a regular browser window, then retry."
    : code === "speech-gpu-required"
      ? transcriptionWords[language].gpuRequired
      : code === "speech-error"
        ? t.error
        : code === "speech-permission"
          ? t.permission
          : code === "speech-no-device" || code === "speech-device-lost"
            ? t.noDevice
            : code === "local-inference-busy"
              ? t.busy
              : code === "speech-unsupported" ||
                  code === "speech-audio-suspended"
                ? t.unsupported
                : code === "speech-backlog"
                  ? t.backlog
                  : code === "session-capacity"
                    ? t.capacity
                    : code === "session-undo-conflict"
                      ? t.undoConflict
                      : code === "session-conflict"
                        ? t.stale
                        : code.startsWith("speech-")
                          ? t.modelError
                          : t.failed;
}

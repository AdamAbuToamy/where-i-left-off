import { useState, useEffect, useRef } from "react";
import type { Language } from "../translations";
export const label = (
  language: Language,
  ar: string,
  en: string,
  he?: string,
) => (language === "ar" ? ar : language === "he" && he ? he : en);
export function useFeatureAction(language: Language) {
  const running = useRef(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  async function run(action: () => void | Promise<void>, success = "") {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
      setMessage(success);
    } catch (e) {
      const code = (e as { code?: string }).code || (e as Error).message;
      setError(
        label(
          language,
          code.includes("cycle")
            ? "لا يمكن إنشاء اعتماد دائري."
            : code.includes("url")
              ? "الرابط غير صالح أو أطول من الحد المسموح."
              : code.includes("conflict")
                ? "تغيّرت البيانات. راجع النسخة الحالية قبل المحاولة."
                : code.includes("empty")
                  ? "أضف نصًا أو رابطًا."
                  : "تعذّر حفظ هذا التغيير. راجع الحقول وحالة الاتصال.",
          code.includes("cycle")
            ? "Dependencies cannot form a cycle."
            : code.includes("url")
              ? "The URL is invalid or too long."
              : code.includes("conflict")
                ? "The data changed. Review the current version before retrying."
                : "Could not save this change. Check the fields and connection.",
        ),
      );
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  return { busy, error, message, run };
}

export function useFeatureNow() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

import { createElement as h } from "react";
import { Bookmark, Check, CornerDownLeft } from "lucide-react";
import type { Language } from "../translations.ts";
const copy = {
  ar: { title: "نجهّز مساحتك", hint: "لنكمل من حيث توقفت." },
  en: {
    title: "Getting your space ready",
    hint: "Let’s pick up where you left off.",
  },
  he: { title: "מכינים את המרחב שלך", hint: "ממשיכים מהמקום שבו עצרת." },
};
/** Shared rendering for build-time HTML and the live React loading screen. */
export default function LoadingScreenView({
  language,
  status,
}: {
  language: Language;
  status: string;
}) {
  const t = copy[language];
  return h(
    "section",
    {
      className: "wilo-loading",
      dir: language === "en" ? "ltr" : "rtl",
      lang: language,
    },
    h(
      "div",
      { className: "wilo-loading-art", "aria-hidden": true },
      h("div", { className: "wilo-loading-orbit" }),
      h(
        "div",
        { className: "wilo-loading-card wilo-loading-card-back" },
        h("i"),
        h("i"),
        h("i"),
      ),
      h(
        "div",
        { className: "wilo-loading-card wilo-loading-card-front" },
        h(
          "span",
          { className: "wilo-loading-bookmark" },
          h(Bookmark, { size: 27, strokeWidth: 1.7 }),
        ),
        h("span", { className: "wilo-loading-card-lines" }, h("i"), h("i")),
        h(
          "span",
          { className: "wilo-loading-check" },
          h(Check, { size: 13, strokeWidth: 2.5 }),
        ),
      ),
      h(
        "span",
        { className: "wilo-loading-return" },
        h(CornerDownLeft, { size: 18, strokeWidth: 1.6 }),
      ),
      h("span", { className: "wilo-loading-dot" }),
    ),
    h(
      "span",
      { className: "wilo-loading-wordmark", "aria-hidden": true },
      "WILO",
      h("span", null, " / "),
    ),
    h("h2", null, t.title),
    h("p", { className: "wilo-loading-hint" }, t.hint),
    h(
      "div",
      { className: "wilo-loading-track", "aria-hidden": true },
      h("span"),
    ),
    h(
      "p",
      { className: "wilo-loading-status", role: "status", "aria-atomic": true },
      status,
    ),
  );
}

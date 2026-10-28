import type { SessionState, SessionItem, SessionNote } from "./domain";
import type { SessionControlValues } from "./control";
export type SpokenSegment = {
  id: string;
  sequence: number;
  text: string;
  at: number;
  final: boolean;
  sessionId: string;
  revision: number;
  order: string[];
};
export type SessionUnderstanding =
  | { kind: "command"; values: SessionControlValues }
  | {
      kind: "ambiguous";
      verb: SessionControlValues["verb"];
      text?: string;
      choices: SessionItem[];
    }
  | { kind: "remaining"; items: SessionItem[] }
  | { kind: "confirm"; number: number }
  | { kind: "speech"; text: string; category: SessionNote["category"] }
  | { kind: "stale" };
/** Preserve original words/case while matching multilingual command prefixes. */
function folded(input: string) {
  const positions: number[] = [],
    chars: string[] = [];
  let offset = 0;
  for (const char of input) {
    const normalized = char
      .normalize("NFKC")
      .toLowerCase()
      .replace(/\p{M}/gu, "")
      .replace(/[أإآٱ]/g, "ا")
      .replace(/ة/g, "ه")
      .replace(/ى/g, "ي");
    for (let i = 0; i < normalized.length; i++) {
      chars.push(normalized[i]);
      positions.push(offset);
    }
    offset += char.length;
  }
  positions.push(input.length);
  return { text: chars.join(""), positions };
}
export const sessionTextKey = (text: string) =>
  folded(text)
    .text.replace(/[\p{P}\p{Z}\s]+/gu, " ")
    .trim();
function groups(raw: string, pattern: RegExp): Record<string, string> | null {
  const fold = folded(raw),
    match = pattern.exec(fold.text) as
      | (RegExpExecArray & {
          indices?: { groups?: Record<string, [number, number]> };
        })
      | null;
  if (!match) return null;
  return Object.fromEntries(
    Object.entries(match.indices?.groups || {}).map(([key, range]) => [
      key,
      range
        ? raw.slice(fold.positions[range[0]], fold.positions[range[1]]).trim()
        : "",
    ]),
  );
}
const notePatterns = [
  /^(?:سجل|دون|اكتب|ضيف|اضف)\s+(?:لي\s+)?(?:ملاحظه|نقطه)\s*[:،-]?\s+(?<text>.+)$/du,
  /^(?:take|add|record|save|write)(?:\s+a)?\s+note\s*[:,-]?\s+(?<text>.+)$/du,
  /^(?:רשום|רשמי|הוסף|הוסיפי|כתוב)\s+(?:הערה|פתק)\s*[:,-]?\s+(?<text>.+)$/du,
  /^(?:note|ملاحظه|הערה)\s*[:،]\s*(?<text>.+)$/du,
];
const addPatterns = [
  /^(?:ضيف|اضف|حط|زيد)\s+(?:بند\s+)?(?<text>.+?)\s+(?:للتشيك\s*ليست|للشيك\s*ليست|للقائمه|لقائمه\s+المهام|(?:علي|في)\s+(?:التشيك\s*ليست|الشيك\s*ليست|القائمه|قائمه\s+المهام))$/du,
  /^(?:ضيف|اضف)\s+(?:بند|مهمه)\s+(?<text>.+)$/du,
  /^add\s+(?:item\s+|task\s+)?(?<text>.+?)\s+to\s+(?:my\s+|the\s+)?(?:checklist|list)$/du,
  /^add\s+(?:item|task)\s+(?<text>.+)$/du,
  /^(?:הוסף|הוסיפי)\s+(?<text>.+?)\s+לרשימה$/du,
  /^(?:הוסף|הוסיפי)\s+(?:משימה|סעיף)\s+(?<text>.+)$/du,
];
const targetPatterns: {
  verb: SessionControlValues["verb"];
  patterns: RegExp[];
}[] = [
  {
    verb: "reopen_item",
    patterns: [
      /^(?:رجع|ارجع|اعد\s+فتح)\s+(?<label>.+?)\s+(?:لغير\s+مكتمل|غير\s+مكتمل|للقائمه|مفتوح)$/du,
      /^reopen\s+(?<label>.+)$/du,
      /^mark\s+(?<label>.+?)\s+(?:as\s+)?incomplete$/du,
      /^פתח\s+מחדש\s+(?<label>.+)$/du,
      /^סמן\s+(?<label>.+?)\s+כלא\s+הושלם$/du,
    ],
  },
  {
    verb: "complete_item",
    patterns: [
      /^(?:خلصت|انهيت|انجزت)\s+(?:بند\s+|مهمه\s+)?(?<label>.+)$/du,
      /^(?:complete|finish|finished|completed)\s+(?:item\s+)?(?<label>.+)$/du,
      /^mark\s+(?<label>.+?)\s+(?:as\s+)?(?:done|complete)$/du,
      /^(?:סיימתי|השלם|סמן\s+כהושלם)\s+(?<label>.+)$/du,
    ],
  },
  {
    verb: "delete_item",
    patterns: [
      /^(?:احذف|امسح|شيل|ازل)\s+(?:بند\s+|مهمه\s+)?(?<label>.+?)(?:\s+من\s+القائمه)?$/du,
      /^(?:delete|remove)\s+(?:item\s+|task\s+)?(?<label>.+?)(?:\s+from\s+(?:the\s+)?(?:list|checklist))?$/du,
      /^(?:מחק|הסר|מחקי)\s+(?:את\s+)?(?:הסעיף\s+)?(?<label>.+)$/du,
    ],
  },
  {
    verb: "edit_item",
    patterns: [
      /^(?:عدل|غير)\s+(?:بند\s+)?(?<label>.+?)\s+(?:الي|ليصبح)\s+(?<text>.+)$/du,
      /^(?:rename|change|edit)\s+(?:item\s+)?(?<label>.+?)\s+to\s+(?<text>.+)$/du,
      /^(?:שנה|ערוך)\s+(?<label>.+?)\s+ל[:־-]?\s*(?<text>.+)$/du,
    ],
  },
];
const ordinals: Record<string, number> = {
  الاول: 1,
  اول: 1,
  الاولي: 1,
  الثاني: 2,
  ثاني: 2,
  الثالث: 3,
  ثالث: 3,
  الرابع: 4,
  الخامس: 5,
  السادس: 6,
  السابع: 7,
  الثامن: 8,
  التاسع: 9,
  العاشر: 10,
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  הראשון: 1,
  ראשון: 1,
  השני: 2,
  שני: 2,
  השלישי: 3,
  שלישי: 3,
};
function target(label: string, state: SessionState, segment: SpokenSegment) {
  const folded = sessionTextKey(label).replace(
      /^(?:البند|بند|item|סעיף|הסעיף)\s+/,
      "",
    ),
    number = /^\d+$/.test(folded) ? Number(folded) : ordinals[folded];
  if (number) {
    if (
      JSON.stringify(segment.order) !==
      JSON.stringify(state.items.map((item) => item.id))
    )
      return null;
    const id = segment.order[number - 1];
    return state.items.filter((item) => item.id === id);
  }
  const exact = state.items.filter(
    (item) => sessionTextKey(item.text) === folded,
  );
  return exact.length
    ? exact
    : state.items.filter((item) => sessionTextKey(item.text).includes(folded));
}
/** A conservative local command grammar. Uncertainty/quotes become speech, never mutations. */
export function understandSessionSpeech(
  segment: SpokenSegment,
  state: SessionState,
): SessionUnderstanding {
  if (
    !segment.final ||
    segment.sessionId !== state.id ||
    segment.revision !== state.contentRevision
  )
    return { kind: "stale" };
  const raw = segment.text
      .trim()
      .replace(/^(?:لو سمحت|من فضلك|بليز|please|בבקשה)\s*[,،]?\s*/iu, ""),
    fold = folded(raw).text;
  const speech = (): SessionUnderstanding => ({
    kind: "speech",
    text: segment.text.trim(),
    category: /قرار|قررنا|اتفقنا|decid|החלט/.test(fold)
      ? "decision"
      : /مشكل|خطا|سبب|problem|error|issue|בעיה|שגיאה/.test(fold)
        ? "problem"
        : /القادم|لازم|بعدين|next|need to|הבא|צריך/.test(fold)
          ? "next"
          : "note",
  });
  if (
    /^ما\s+(?:بقي|تبقي|ضايل|باقي)(?:\s+(?:بالقائمه|في\s+القائمه))?[؟?!.]*$/u.test(
      fold,
    )
  )
    return {
      kind: "remaining",
      items: state.items.filter((item) => !item.done),
    };
  if (
    !raw ||
    raw.length > 1000 ||
    /^["'“«]|^(?:لا|ما|مش|مو|يمكن|ممكن|ربما|لو|اظن|اعتقد|قال|حكي|اقتباس|don't|do not|maybe|perhaps|could|should|what if|quote|he said|she said|אל|לא|אולי|ייתכן|אפשר|הוא אמר)(?:\s|[:،]|$)/u.test(
      fold,
    )
  )
    return speech();
  for (const pattern of notePatterns) {
    const match = groups(raw, pattern);
    if (match)
      return {
        kind: "command",
        values: {
          sessionId: state.id,
          expectedRevision: state.contentRevision,
          verb: "add_note",
          text: match.text,
        },
      };
  }
  const confirm = fold.match(
    /^(?:نفذ\s+(?:ال)?اقتراح|اكد\s+(?:ال)?اقتراح|confirm\s+proposal|אשר\s+הצעה)\s+(?:رقم\s+)?(\d{1,3})[.!؟?]?$/u,
  );
  if (confirm) return { kind: "confirm", number: Number(confirm[1]) };
  if (
    /^(?:شو|ايش|ماذا|ما)\s+(?:ضل|بقي|متبقي|تبقي|ضايل|باقي)(?:\s+(?:بالقائمه|في\s+القائمه|بالتشيك\s*ليست))?[؟?!.]*$/u.test(
      fold,
    ) ||
    /^(?:what(?:'s| is) left|what remains)(?: (?:on|in) (?:my |the )?(?:list|checklist))?[?!.]*$/u.test(
      fold,
    ) ||
    /^מה נשאר(?: ברשימה)?[?!.]*$/u.test(fold)
  )
    return {
      kind: "remaining",
      items: state.items.filter((item) => !item.done),
    };
  if (
    /^تراجع\s+عن\s+(?:اخر\s+)?(?:تعديل|تغيير)(?:\s+صوتي)?[.!؟?]?$/u.test(
      fold,
    ) ||
    /^undo(?: the)?(?: last)?(?: voice)?(?: change| edit)?[.!?]?$/u.test(
      fold,
    ) ||
    /^בטל(?: את)?(?: השינוי)?(?: הקולי)?(?: האחרון)?[.!?]?$/u.test(fold)
  )
    return {
      kind: "command",
      values: {
        sessionId: state.id,
        expectedRevision: state.contentRevision,
        verb: "undo",
      },
    };
  for (const pattern of addPatterns) {
    const match = groups(raw, pattern);
    if (match)
      return {
        kind: "command",
        values: {
          sessionId: state.id,
          expectedRevision: state.contentRevision,
          verb: "add_item",
          text: match.text,
        },
      };
  }
  for (const intent of targetPatterns)
    for (const pattern of intent.patterns) {
      const match = groups(raw, pattern);
      if (!match) continue;
      const choices = target(match.label, state, segment);
      if (!choices) return { kind: "stale" };
      if (choices.length !== 1)
        return {
          kind: "ambiguous",
          verb: intent.verb,
          text: match.text,
          choices,
        };
      return {
        kind: "command",
        values: {
          sessionId: state.id,
          expectedRevision: state.contentRevision,
          verb: intent.verb,
          id: choices[0].id,
          ...(match.text ? { text: match.text } : {}),
        },
      };
    }
  return speech();
}

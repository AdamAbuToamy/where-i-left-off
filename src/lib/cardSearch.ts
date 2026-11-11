/** Unicode-aware, all-word matching without changing any saved card content. */
export function normalizeCardSearch(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/ـ/g, "")
    .toLocaleLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
export function matchesCardSearch(content: string, query: string) {
  const words = normalizeCardSearch(query).split(" ").filter(Boolean);
  if (!words.length) return true;
  const normalized = normalizeCardSearch(content);
  return words.every((word) => normalized.includes(word));
}

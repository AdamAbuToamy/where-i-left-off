export class FeatureError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}
export const invalid = (): never => {
  throw new FeatureError("experience-invalid");
};
export function object(v: unknown, keys: string[]): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return invalid();
  const o = v as Record<string, unknown>;
  if (
    Object.keys(o).some((k) => !keys.includes(k)) ||
    keys.some((k) => !(k in o))
  )
    return invalid();
  return o;
}
export function text(v: unknown, max = 1000): string {
  if (typeof v !== "string" || v.length > max) return invalid();
  return v;
}
export function id(v: unknown): string {
  const s = text(v, 180);
  if (!/^[-\w/]{1,180}$/.test(s)) return invalid();
  return s;
}
export function number(v: unknown, min = 0, max = 9000000000000000): number {
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max)
    return invalid();
  return v;
}
export function list<T>(v: unknown, parse: (v: unknown) => T, max = 200): T[] {
  if (!Array.isArray(v) || v.length > max) return invalid();
  return v.map(parse);
}
export function choice<T extends string>(v: unknown, options: readonly T[]): T {
  if (typeof v !== "string" || !options.includes(v as T)) return invalid();
  return v as T;
}
export function unique<T extends { id: string }>(items: T[]): T[] {
  if (new Set(items.map((i) => i.id)).size !== items.length) return invalid();
  return items;
}
export function day(v: unknown): string {
  const s = text(v, 10);
  if (s && !/^\d{4}-\d{2}-\d{2}$/.test(s)) return invalid();
  if (s && new Date(s + "T00:00:00Z").toISOString().slice(0, 10) !== s)
    return invalid();
  return s;
}
export function url(v: unknown): string {
  const s = text(v, 2000);
  if (!s) return s;
  try {
    const u = new URL(s);
    if (!["https:", "http:"].includes(u.protocol) || u.username || u.password)
      return invalid();
    return u.href;
  } catch {
    return invalid();
  }
}

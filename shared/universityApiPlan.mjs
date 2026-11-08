export class ApiError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}
export const validId = (value) =>
  typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
export function object(value, allowed, required = []) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).some((k) => !allowed.includes(k)) ||
    required.some((k) => !Object.hasOwn(value, k))
  )
    throw new ApiError("invalid-input");
  return value;
}

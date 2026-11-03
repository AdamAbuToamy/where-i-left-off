/** Product eligibility policy, not identity or legal-age verification. */
export const MINIMUM_REGISTRATION_AGE = 16;
export type RegistrationAgeBand = "" | "under16" | "16plus";
export function registrationEligible(value: unknown): value is "16plus" {
  return value === "16plus";
}

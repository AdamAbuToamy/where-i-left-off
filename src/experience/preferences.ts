export type ExperiencePreferences = { sound: boolean; motion: boolean };
export const experienceEvent = "wilo-experience-preferences";
const key = (uid: string) => `wilo-experience:v1:${uid}`;
export function readExperience(uid: string): ExperiencePreferences {
  try {
    const value = JSON.parse(localStorage.getItem(key(uid)) || "{}");
    return { sound: value?.sound !== false, motion: value?.motion !== false };
  } catch {
    return { sound: true, motion: true };
  }
}
export function saveExperience(uid: string, value: ExperiencePreferences) {
  try {
    localStorage.setItem(key(uid), JSON.stringify(value));
  } catch {
    /* Session controls still work. */
  }
  window.dispatchEvent(
    new CustomEvent(experienceEvent, { detail: { uid, value } }),
  );
}

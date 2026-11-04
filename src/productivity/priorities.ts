import type { ExperienceState } from "./state";
import { parseExperience } from "./state";
import { FeatureError } from "./schema";
export function prioritize(
  state: ExperienceState,
  card: string,
  day: string,
): ExperienceState {
  const current = state.today.day === day ? state.today.cards : [];
  const cards = current.includes(card)
    ? current.filter((id) => id !== card)
    : [...current, card];
  if (cards.length > 3) throw new FeatureError("experience-three-priorities");
  return parseExperience({ ...state, today: { day, cards } });
}
export function dailyCards(
  state: ExperienceState,
  day: string,
  available: Set<string>,
) {
  return state.today.day === day
    ? state.today.cards.filter((key) => available.has(key))
    : [];
}

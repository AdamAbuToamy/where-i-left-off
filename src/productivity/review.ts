import { parseExperience } from "./state";
import type { ExperienceState } from "./state";
import { needsReview, currentCard } from "../lib/workflow";
import type { Project } from "../types";
export function reviewLater(
  state: ExperienceState,
  id: string,
  until: string,
  now: number,
): ExperienceState {
  return parseExperience({
    ...state,
    reviews: [
      ...state.reviews.filter((r) => r.id !== id),
      { id, until, reviewedAt: now },
    ],
  });
}
export function reviewCandidates(
  projects: Project[],
  state: ExperienceState,
  today: string,
  now: number,
  days = 30,
) {
  return projects.filter((p) => {
    if (!currentCard(p) || p.status === "done") return false;
    const review = state.reviews.find((r) => r.id === "personal/" + p.id);
    if (review?.until && review.until > today) return false;
    const reviewedRecently = review && now - review.reviewedAt < 7 * 86400000;
    return (
      (p.status === "waiting" && !!p.followUpDate && p.followUpDate <= today) ||
      (!reviewedRecently && needsReview(p, days, now))
    );
  });
}

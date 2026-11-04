import { parseExperience } from "./state";
import type { ExperienceState, InboxItem } from "./state";
import { url, FeatureError } from "./schema";
export function capture(
  state: ExperienceState,
  id: string,
  text: string,
  link: string,
  now: number,
): ExperienceState {
  const content = text.trim(),
    address = url(link.trim());
  if (!content && !address) throw new FeatureError("experience-empty");
  return parseExperience({
    ...state,
    inbox: [
      {
        id,
        text: content || new URL(address).hostname,
        url: address,
        createdAt: now,
        cardId: "",
      },
      ...state.inbox,
    ],
  });
}
export function captureCard(item: InboxItem) {
  if (item.url.length > 500) throw new FeatureError("experience-url-length");
  return {
    id: item.id,
    name: item.text.split("\n")[0].slice(0, 100),
    nextStep: "",
    details: {
      description: item.text,
      projectUrl: item.url,
      status: "later" as const,
    },
  };
}
export function captured(state: ExperienceState, id: string): ExperienceState {
  return parseExperience({
    ...state,
    inbox: state.inbox.map((item) =>
      item.id === id ? { ...item, cardId: item.id } : item,
    ),
  });
}

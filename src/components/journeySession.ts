export const journeySteps = [
  "welcome",
  "create",
  "card",
  "university",
  "groups",
  "finish",
] as const;
export type JourneyStep = (typeof journeySteps)[number];
export type JourneySession = { step: JourneyStep; ids: string[] };
export function parseJourneySession(
  value: string | null,
): JourneySession | null {
  try {
    const data: unknown = JSON.parse(value || "null");
    if (
      !data ||
      typeof data !== "object" ||
      !("step" in data) ||
      !("ids" in data) ||
      !journeySteps.includes(data.step as JourneyStep) ||
      !Array.isArray(data.ids) ||
      data.ids.length > 30 ||
      !data.ids.every(
        (id: unknown) => typeof id === "string" && /^[-\w]{1,100}$/.test(id),
      )
    )
      return null;
    return {
      step: data.step as JourneyStep,
      ids: [...new Set(data.ids as string[])],
    };
  } catch {
    return null;
  }
}

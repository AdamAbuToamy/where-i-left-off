import { it, expect } from "vitest";
import { parseJourneySession } from "../src/components/journeySession";
it("restores bounded receipts without accepting malformed state", () => {
  expect(
    parseJourneySession(JSON.stringify({ step: "card", ids: ["a", "a", "b"] })),
  ).toEqual({ step: "card", ids: ["a", "b"] });
  for (const v of [
    null,
    "broken",
    JSON.stringify({ step: "admin", ids: [] }),
    JSON.stringify({ step: "card", ids: ["../other"] }),
    JSON.stringify({ step: "card", ids: Array(31).fill("a") }),
  ])
    expect(parseJourneySession(v)).toBeNull();
});

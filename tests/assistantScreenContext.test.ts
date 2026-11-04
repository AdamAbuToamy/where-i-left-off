import { it, expect } from "vitest";
import { blankAssistantData } from "../src/assistant/actions";
import { screenSelection } from "../src/assistant/screenContext";
import { conversationHistory } from "../src/assistant/conversationHistory";
it("uses only an actual authorized open card/course and rejects arbitrary route references", () => {
  const data = blankAssistantData();
  data.scopes[0].projects.push({
    id: "a",
    name: "Current",
    nextStep: "",
    rank: 0,
    revision: 0,
    status: "later",
  });
  expect(screenSelection(data, "#/personal/a?token=must-not-copy")).toEqual({
    page: "personal",
    card: { scope: "personal", id: "a", name: "Current" },
  });
  expect(screenSelection(data, "#/personal/foreign")).toBeNull();
  expect(screenSelection(data, "#/groups/unauthorized/a")).toBeNull();
  expect(screenSelection(data, "#/personal", ["a", "b"])).toBeNull();
  expect(screenSelection(data, "#/personal", ["a"])?.card?.id).toBe("a");
  data.scopes[0].projects[0].trashedAt = 1;
  expect(screenSelection(data, "#/personal/a")).toBeNull();
});
it("keeps unfinished creation details through clarification turns", () => {
  const history = conversationHistory([
    { role: "user", text: "Create Ammar with note Marwan on the 28th" },
    {
      role: "assistant",
      text: "Which section?",
      reply: {
        text: "Which section?",
        actions: [],
        controls: [],
        files: [],
        clarification: "Which section?",
      },
    },
    { role: "user", text: "A new section Adam" },
  ]);
  expect(JSON.stringify(history)).toContain("note Marwan on the 28th");
  expect(JSON.stringify(history)).toContain("Which section?");
  expect(JSON.stringify(history)).toContain("A new section Adam");
});

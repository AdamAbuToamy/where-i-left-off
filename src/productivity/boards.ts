import { parseExperience } from "./state";
import type { ExperienceState } from "./state";
import { FeatureError } from "./schema";
import type { PlanningState } from "../planning/domain";
import { parsePlanningState } from "../planning/domain";
export function addNamedBoard(
  state: ExperienceState,
  id: string,
  name: string,
  scope = "",
) {
  const title = name.trim();
  if (!title || !/^[-\w]{1,80}$/.test(id))
    throw new FeatureError("experience-empty");
  if (
    state.boards.some(
      (b) =>
        !b.archived &&
        b.scope === scope &&
        b.name.normalize("NFKC").toLocaleLowerCase() ===
          title.normalize("NFKC").toLocaleLowerCase(),
    )
  )
    throw new FeatureError("experience-board-duplicate");
  return parseExperience({
    ...state,
    boards: [...state.boards, { id, name: title, scope, archived: false }],
  });
}
export function noteCardDraft(state: PlanningState, id: string) {
  const note = state.items.find((i) => i.id === id);
  if (note?.kind !== "note" || !note.text.trim())
    throw new FeatureError("experience-empty");
  if (note.text.length > 1000) throw new FeatureError("experience-note-long");
  return {
    id: "board_" + id,
    name: note.text.trim().split("\n")[0].slice(0, 100),
    description: note.text,
  };
}
export function convertedBoardNote(
  state: PlanningState,
  id: string,
  projectId: string,
) {
  if (!state.items.some((i) => i.id === id && i.kind === "note"))
    throw new FeatureError("experience-missing");
  return parsePlanningState({
    ...state,
    items: state.items.map((item) =>
      item.id === id
        ? { id: item.id, kind: "card", projectId, x: item.x, y: item.y }
        : item,
    ),
  });
}

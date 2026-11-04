import { it, expect } from "vitest";
import { emptyExperience } from "../src/productivity/state";
import {
  emptyPlanningState,
  addBoardNote,
  editBoardNote,
  addBoardCard,
  connectBoardItems,
} from "../src/planning/domain";
import {
  addNamedBoard,
  noteCardDraft,
  convertedBoardNote,
} from "../src/productivity/boards";
it("keeps named boards independent and converts a note without losing its position or thread references", () => {
  const s = addNamedBoard(emptyExperience(), "board1", "Plan");
  expect(s.boards[0]).toMatchObject({
    name: "Plan",
    scope: "",
    archived: false,
  });
  expect(() => addNamedBoard(s, "board2", " Plan ")).toThrow("duplicate");
  let board = editBoardNote(
    addBoardNote(emptyPlanningState(), "note", { x: 33, y: 77 }),
    "note",
    "Research this",
  );
  board = addBoardCard(board, "a", { x: 200, y: 0 });
  board = connectBoardItems(board, "thread", "note", "a");
  const card = noteCardDraft(board, "note"),
    converted = convertedBoardNote(board, "note", card.id);
  expect(converted.items[0]).toEqual({
    id: "note",
    kind: "card",
    projectId: "board_note",
    x: 33,
    y: 77,
  });
  expect(converted.threads).toEqual(board.threads);
  expect(board.items[0].kind).toBe("note");
});

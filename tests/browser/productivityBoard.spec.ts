import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { pilot, hub } from "./productivityFixture";
test("task 10: named board note conversion and real PNG/PDF export retain independent state", async ({
  page,
  request,
}) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await pilot(page, request, ["Canvas source"]);
  const dialog = await hub(page, "My boards");
  await dialog.getByLabel("Board name", { exact: true }).fill("Strategy board");
  await dialog
    .getByRole("button", { name: "Create board", exact: true })
    .click();
  await expect(dialog.locator("header [role=status]")).toHaveText(
    "Saved to account",
    { timeout: 15000 },
  );
  await dialog
    .getByRole("link", { name: "Strategy board ↗", exact: true })
    .click();
  const board = page.locator(".planning-board-dialog[open]");
  await expect(board).toBeVisible();
  await expect(
    board.getByRole("combobox", { name: "Board", exact: true }),
  ).toContainText("Strategy board");
  await board.getByRole("button", { name: "Add card", exact: true }).click();
  await board
    .locator(".planning-card-picker")
    .getByRole("button", { name: "Canvas source", exact: true })
    .click();
  await board.getByRole("button", { name: "Add card", exact: true }).click();
  await board.getByRole("button", { name: "Sticky note", exact: true }).click();
  const note = board.locator(".react-flow__node-note");
  await note.getByRole("textbox", { name: "Sticky note", exact: true }).click();
  await note
    .getByRole("textbox", { name: "Sticky note", exact: true })
    .pressSequentially("Converted board note", { delay: 25 });
  await note
    .getByRole("button", { name: "Convert to card", exact: true })
    .click();
  await expect(
    board.getByRole("heading", { name: "Converted board note", exact: true }),
  ).toBeVisible();
  await expect(board.locator(".react-flow__node-note")).toHaveCount(0);
  await expect(board.locator(".planning-save")).toHaveText("Saved", {
    timeout: 15000,
  });
  await board
    .locator(".planning-help:not(.planning-named-create)>summary")
    .click();
  const pngPromise = page.waitForEvent("download");
  await board.getByRole("button", { name: "PNG", exact: true }).click();
  const png = await pngPromise;
  expect(png.suggestedFilename()).toMatch(/Strategy board.*\.png$/);
  await png.saveAs(".wrangler/ten-board.png");
  const bytes = await readFile(".wrangler/ten-board.png");
  expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  expect(bytes.length).toBeGreaterThan(10000);
  const pdfPromise = page.waitForEvent("download");
  await board.getByRole("button", { name: "PDF", exact: true }).click();
  const pdf = await pdfPromise;
  await pdf.saveAs(".wrangler/ten-board.pdf");
  expect(
    (await readFile(".wrangler/ten-board.pdf")).subarray(0, 5).toString(),
  ).toBe("%PDF-");
  await page.screenshot({
    path: ".wrangler/ten-board-ui.png",
    animations: "disabled",
  });
  await board.getByRole("button", { name: "Close board", exact: true }).click();
  await expect(
    page
      .locator(".envelope-summary h2")
      .filter({ hasText: "Converted board note" }),
  ).toHaveCount(1);
  await page
    .getByRole("button", { name: "Planning board", exact: true })
    .click();
  await expect(board.locator(".react-flow__node-card")).toHaveCount(2);
  await page.reload();
  await page
    .getByRole("button", { name: "Planning board", exact: true })
    .click();
  await expect(board.locator(".react-flow__node-card")).toHaveCount(0);
});

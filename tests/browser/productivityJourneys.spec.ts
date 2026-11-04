import { test, expect } from "@playwright/test";
import { pilot, hub, choose, studySeed } from "./productivityFixture";
test.use({
  viewport: { width: 1440, height: 1000 },
  timezoneId: "Asia/Jerusalem",
});
test("task 2: three priorities persist and a work session opens from Resume", async ({
  page,
  request,
}) => {
  const c = await pilot(page, request, [
    "Daily A",
    "Daily B",
    "Daily C",
    "Daily D",
  ]);
  const dialog = await hub(page, "Today");
  await dialog.getByText("Choose today’s priorities", { exact: false }).click();
  for (const card of c.cards.slice(0, 3))
    await dialog.getByLabel(card.name, { exact: true }).check();
  await expect(dialog.getByLabel("Daily D", { exact: true })).toBeDisabled();
  await expect(dialog.locator(".pilot-grid .pilot-resume-card")).toHaveCount(3);
  await expect(dialog.locator("header [role=status]")).toHaveText(
    "Saved to account",
    { timeout: 15000 },
  );
  await dialog.getByLabel("Close work hub", { exact: true }).click();
  await page.goto("/#/resume");
  await expect(page.locator(".pilot-grid .pilot-resume-card")).toHaveCount(3);
  await page
    .locator(".pilot-grid .pilot-resume-card")
    .first()
    .getByRole("button", { name: "Work session", exact: true })
    .click();
  await expect(page.locator("dialog.focus-dialog[open]")).toBeVisible();
});
test("task 3: dependencies appear and a reverse cycle is refused", async ({
  page,
  request,
}) => {
  await pilot(page, request, ["Depends A", "Depends B"]);
  const dialog = await hub(page, "Relationships");
  await choose(page, "Card", "Depends A");
  await choose(page, "Relationship", "Depends on");
  await choose(page, "Other card", "Depends B");
  await dialog
    .getByRole("button", { name: "Add relationship", exact: true })
    .click();
  await expect(dialog.locator(".pilot-list")).toContainText("Depends B");
  await choose(page, "Card", "Depends B");
  await choose(page, "Other card", "Depends A");
  await dialog
    .getByRole("button", { name: "Add relationship", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText("cycle");
  await expect(dialog.locator(".pilot-list article")).toHaveCount(1);
});
test("task 4: work blocks check classes and never change the card deadline", async ({
  page,
  request,
}) => {
  test.setTimeout(60000);
  const c = await pilot(page, request, ["Scheduled work"]);
  await studySeed(request, c.uid);
  const dialog = await hub(page, "Work time");
  await choose(page, "Card", "Scheduled work");
  await dialog
    .getByLabel("Start time", { exact: true })
    .fill("2026-11-04T11:00");
  await dialog
    .getByRole("button", { name: "Schedule work", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText("overlaps");
  await expect(dialog.locator(".pilot-calendar article")).toHaveCount(0);
  await dialog
    .getByRole("button", { name: "Save despite overlap", exact: true })
    .click();
  await expect(dialog.locator(".pilot-calendar")).toContainText(
    "Scheduled work",
  );
  await expect(dialog.locator("header [role=status]")).toHaveText(
    "Saved to account",
    { timeout: 15000 },
  );
  await dialog.getByLabel("Close work hub", { exact: true }).click();
  await page.goto("/#/personal/" + c.cards[0].id);
  await expect(
    page.locator('[data-project-id="' + c.cards[0].id + '"]'),
  ).toContainText("2027-02-03");
});
test("task 5: review snooze hides a stale card without moving its deadline", async ({
  page,
  request,
}) => {
  await pilot(page, request, ["Stale review"]);
  const dialog = await hub(page, "Review");
  const row = dialog
    .locator(".pilot-list article")
    .filter({ hasText: "Stale review" });
  await expect(row).toBeVisible();
  await row
    .getByRole("button", { name: "Review next week", exact: true })
    .click();
  await expect(row).toHaveCount(0);
  await dialog
    .getByRole("button", { name: "Review all cards", exact: true })
    .click();
  await expect(row).toBeVisible();
});
test("task 6: course checkpoint resources weighted grades and reviewed revision tasks save", async ({
  page,
  request,
}) => {
  test.setTimeout(90000);
  const c = await pilot(page, request, []);
  const course = await studySeed(request, c.uid);
  const dialog = await hub(page, "University");
  await choose(page, "Course", course.name);
  await dialog.getByText("Study workspace", { exact: true }).click();
  await dialog
    .getByLabel("Where did you stop?", { exact: true })
    .fill("Reached lecture 4");
  await dialog
    .getByLabel("Next study step", { exact: true })
    .fill("Solve exercise 2");
  await dialog
    .getByRole("button", { name: "Save course plan", exact: true })
    .click();
  await dialog.getByText("Exam & revision plan", { exact: true }).click();
  await dialog.getByLabel("Exam date", { exact: true }).fill("2026-11-10");
  await dialog
    .getByLabel("Topics — one per line", { exact: true })
    .fill("Routing\nProtocols");
  await dialog
    .getByRole("button", { name: "Prepare revision plan", exact: true })
    .click();
  await expect(
    dialog.getByRole("button", { name: "Add revision tasks", exact: true }),
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: "Add revision tasks", exact: true })
    .click();
  await expect(
    dialog.getByRole("status").filter({ hasText: "Revision tasks added" }),
  ).toBeVisible();
  await dialog.getByText("Materials by topic", { exact: true }).click();
  await dialog.getByLabel("Topic", { exact: true }).fill("Routing");
  await dialog.getByLabel("Resource title", { exact: true }).fill("Reference");
  await dialog
    .getByLabel("Public HTTPS link", { exact: true })
    .fill("https://example.com/routing");
  await dialog
    .getByRole("button", { name: "Add resource", exact: true })
    .click();
  await expect(
    dialog.getByRole("link", { name: "Reference ↗", exact: true }),
  ).toBeVisible();
  await dialog
    .getByText("Grade calculation — optional", { exact: true })
    .click();
  await dialog.getByLabel("Enable grade tracking", { exact: true }).check();
  await dialog.getByLabel("Component", { exact: true }).fill("Midterm");
  await dialog.getByLabel("Score", { exact: true }).fill("80");
  await dialog.getByLabel("Weight %", { exact: true }).fill("50");
  await dialog.getByRole("button", { name: "Add grade", exact: true }).click();
  await expect(dialog).toContainText("80.0%");
  await expect(dialog).toContainText("40.0/100");
  await dialog
    .getByRole("button", { name: "Save all course details", exact: true })
    .click();
  await expect(dialog.locator("header [role=status]")).toHaveText(
    "Saved to account",
    { timeout: 15000 },
  );
  await page.reload();
  await page.getByRole("button", { name: "Work hub", exact: true }).click();
  await page.getByRole("tab", { name: "University", exact: true }).click();
  await choose(page, "Course", course.name);
  await page.getByText("Study workspace", { exact: true }).click();
  await expect(
    page.getByLabel("Where did you stop?", { exact: true }),
  ).toHaveValue("Reached lecture 4");
});
test("task 8: an older confirmed card version restores only after review", async ({
  page,
  request,
}) => {
  test.setTimeout(60000);
  const c = await pilot(page, request, ["Version original"]);
  await page.goto("/#/personal/" + c.cards[0].id);
  const card = page.locator('[data-project-id="' + c.cards[0].id + '"]');
  await card.hover();
  await card.locator(".envelope-expand").click();
  await card.getByText("Card options", { exact: true }).click();
  await card.getByRole("button", { name: "Edit", exact: true }).click();
  await card
    .getByLabel("Project name", { exact: true })
    .fill("Version changed");
  await card.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(card.locator(".envelope-content")).toContainText(
    "Version changed",
  );
  const dialog = await hub(page, "History");
  await choose(page, "Card", "Version changed");
  await expect(dialog.locator(".pilot-list article")).toHaveCount(2, {
    timeout: 15000,
  });
  await dialog
    .getByRole("button", { name: "Review restoring this version", exact: true })
    .last()
    .click();
  await expect(
    dialog.getByRole("button", { name: "Apply restoration", exact: true }),
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: "Apply restoration", exact: true })
    .click();
  await dialog.getByLabel("Close work hub", { exact: true }).click();
  await expect(card).toContainText("Version original");
});
test("task 9: reusable templates and manually generated recurrence persist without duplicate clicks", async ({
  page,
  request,
}) => {
  await pilot(page, request, ["Recurring source"]);
  const dialog = await hub(page, "Templates & repeat");
  await dialog
    .getByLabel("New card name", { exact: true })
    .fill("Created from template");
  await dialog
    .getByRole("button", { name: "Create from template", exact: true })
    .click();
  await expect(dialog.getByLabel("New card name", { exact: true })).toHaveValue(
    "",
  );
  await dialog.getByText("Repeat a card", { exact: true }).click();
  await choose(page, "Recurring card", "Recurring source");
  await dialog
    .getByLabel("Next occurrence", { exact: true })
    .fill("2026-11-04");
  await dialog
    .getByRole("button", { name: "Save recurrence", exact: true })
    .click();
  const row = dialog
    .locator(".pilot-list article")
    .filter({ hasText: "Recurring source" });
  await row
    .getByRole("button", { name: "Create displayed occurrence", exact: true })
    .click();
  await expect(row).toContainText("2026-11-11");
  await dialog.getByLabel("Close work hub", { exact: true }).click();
  await page.goto("/#/personal");
  await expect(
    page
      .locator(".envelope-summary h2")
      .filter({ hasText: "Created from template" }),
  ).toHaveCount(1);
  await expect(
    page
      .locator(".envelope-summary h2")
      .filter({ hasText: "Recurring source" }),
  ).toHaveCount(2);
});

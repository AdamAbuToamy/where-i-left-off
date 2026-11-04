import { test, expect } from "@playwright/test";
import { pilot, hub, choose, seed } from "./productivityFixture";
test.use({ timezoneId: "Asia/Jerusalem" });
test("task 9: opted-in automatic recurrence creates one due occurrence and reload cannot duplicate it", async ({
  page,
  request,
}) => {
  test.setTimeout(60000);
  await pilot(page, request, ["Automatic repeat"]);
  const dialog = await hub(page, "Templates & repeat");
  await dialog.getByText("Repeat a card", { exact: true }).click();
  await choose(page, "Recurring card", "Automatic repeat");
  await dialog.getByLabel("Frequency", { exact: true }).click();
  await page.getByRole("option", { name: "Daily", exact: true }).click();
  const today = await page.evaluate(() => {
    const d = new Date();
    return (
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0")
    );
  });
  await dialog.getByLabel("Next occurrence", { exact: true }).fill(today);
  await dialog
    .getByLabel("Create the latest due occurrence when opening the app", {
      exact: true,
    })
    .check();
  await dialog
    .getByRole("button", { name: "Save recurrence", exact: true })
    .click();
  await dialog.getByLabel("Close work hub", { exact: true }).click();
  await page.goto("/#/personal");
  await expect(
    page
      .locator(".envelope-summary h2")
      .filter({ hasText: "Automatic repeat" }),
  ).toHaveCount(2, { timeout: 20000 });
  await expect(
    page.locator(".workspace-connection-menu summary"),
  ).toHaveAttribute("title", "Synced with your account", { timeout: 15000 });
  await page.reload();
  await expect(
    page
      .locator(".envelope-summary h2")
      .filter({ hasText: "Automatic repeat" }),
  ).toHaveCount(2, { timeout: 15000 });
});
test("task 2: last-session context excludes a deleted source card", async ({
  page,
  request,
}) => {
  const c = await pilot(page, request, ["Visible session card"]);
  const base = {
    projectId: c.cards[0].id,
    projectName: "Visible session card",
    groupId: "",
    resourceType: "project",
    startedAt: Date.now() - 300000,
    endedAt: Date.now() - 180000,
    seconds: 120,
    checkpoint: "Saved checkpoint",
    nextStep: "Continue",
  };
  await seed(request, "users/" + c.uid + "/sessions/valid-session", base);
  await seed(request, "users/" + c.uid + "/sessions/deleted-session", {
    ...base,
    projectId: "deleted-card",
    projectName: "Deleted session must stay hidden",
    startedAt: Date.now(),
  });
  await page.goto("/#/resume");
  await expect(page.locator(".pilot-last")).toContainText(
    "Visible session card",
  );
  await expect(page.locator(".pilot-last")).not.toContainText(
    "Deleted session must stay hidden",
  );
});

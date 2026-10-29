import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
async function register(page: Page) {
  await page.addInitScript(() => localStorage.setItem("language", "en"));
  await page.goto("/");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page
    .getByLabel("Personal name", { exact: true })
    .fill("Workflow tester");
  await page
    .getByLabel("Email", { exact: true })
    .fill(`workflow-${Date.now()}@example.test`);
  await page.getByLabel("Password", { exact: true }).fill("Test-Password-2026");
  await page
    .locator("form")
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.locator(".side-navigation-toggle")).toBeVisible();
  const skip = page.locator(".welcome-guide .guide-skip");
  if (await skip.isVisible()) await skip.click();
  await expect(page.locator(".welcome-guide")).toHaveCount(0);
}
async function add(page: Page, name: string) {
  await page.getByRole("button", { name: "New card", exact: true }).click();
  await page.getByLabel("Card title", { exact: true }).fill(name);
  await page.getByLabel("Next step", { exact: true }).fill("Continue tomorrow");
  await page.getByRole("button", { name: "Save card", exact: true }).click();
  await expect(page.locator(".project-card h2")).toHaveText(name);
  await expect(page.locator(".sync-status")).toHaveText(
    "Synced with your account",
  );
}
test("archive and trash restore card contents and archive preference is off by default", async ({
  page,
}) => {
  await register(page);
  await add(page, "Keep my project");
  const card = page.locator(".project-card");
  await card.locator(".card-options summary").click();
  await card.getByRole("button", { name: "Archive card", exact: true }).click();
  await expect(page.locator(".project-card")).toHaveCount(0);
  await page.locator(".side-navigation-toggle").press("Enter");
  await page
    .getByRole("link", { name: "Archive and trash", exact: true })
    .click();
  await expect(page.locator(".library-page")).toContainText("Keep my project");
  await page.getByRole("button", { name: "Restore", exact: true }).click();
  await expect(page.locator(".library-page .resume-card")).toHaveCount(0);
  await page.locator(".side-navigation-toggle").press("Enter");
  await page.getByRole("link", { name: "My projects", exact: true }).click();
  await expect(card).toContainText("Continue tomorrow");
  await card.locator(".card-options summary").click();
  await card.getByRole("button", { name: "Delete", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete", exact: true })
    .click();
  await expect(card).toHaveCount(0);
  await page.locator(".side-navigation-toggle").press("Enter");
  await page
    .getByRole("link", { name: "Archive and trash", exact: true })
    .click();
  await page.getByRole("button", { name: "Trash", exact: true }).click();
  await expect(page.locator(".library-page")).toContainText("Keep my project");
  await page.getByRole("button", { name: "Restore", exact: true }).click();
  await page.locator(".side-navigation-toggle").press("Enter");
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await page
    .locator(".settings-group > summary")
    .filter({ hasText: "Work organization" })
    .click();
  const setting = page.getByLabel(
    "Automatically archive completed personal cards after 7 days",
    { exact: true },
  );
  await expect(setting).not.toBeChecked();
  await setting.check();
  await expect(page.locator(".workflow-settings")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await expect(page.locator(".workflow-settings [role=alert]")).toHaveCount(0);
  await page.reload();
  await page
    .locator(".settings-group > summary")
    .filter({ hasText: "Work organization" })
    .click();
  await expect(setting).toBeChecked();
  await setting.uncheck();
});
test("a work session saves checkpoint and next step and appears in personal analytics", async ({
  page,
}) => {
  await register(page);
  await add(page, "Robot work");
  await page.getByRole("button", { name: "Work session", exact: true }).click();
  const dialog = page.locator(".focus-dialog");
  await expect(dialog).toBeVisible();
  await dialog.locator(".focus-checkpoint-details summary").click();
  await dialog
    .getByLabel("What did you finish? / Where did you stop?", { exact: true })
    .fill("Bearing mounted");
  await dialog
    .getByLabel("What is your first step when you return?", { exact: true })
    .fill("Test base movement");
  await dialog
    .getByRole("button", { name: "End session", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator(".project-card")).toContainText("Bearing mounted");
  await expect(page.locator(".project-card")).toContainText(
    "Test base movement",
  );
  await page.locator(".side-navigation-toggle").press("Enter");
  await page.getByRole("link", { name: "My progress", exact: true }).click();
  await expect(page.locator(".session-history").first()).toContainText(
    "Bearing mounted",
  );
});
test("book catalog selection preserves manual next step and saves metadata", async ({
  page,
}) => {
  await page.route("https://openlibrary.org/search.json**", (route) =>
    route.fulfill({
      json: {
        docs: [
          {
            key: "/works/OL123W",
            title: "Book for testing",
            author_name: ["Author"],
            number_of_pages_median: 200,
          },
        ],
      },
    }),
  );
  await page.route("https://openlibrary.org/works/OL123W.json", (route) =>
    route.fulfill({ json: { description: "Book description" } }),
  );
  await register(page);
  await page.getByRole("button", { name: "New card", exact: true }).click();
  await page.getByLabel("Card title", { exact: true }).fill("Book for testing");
  await page.getByLabel("Next step", { exact: true }).fill("Read chapter one");
  await page.getByLabel("Card content", { exact: true }).selectOption("book");
  await page.locator(".catalog-result").click();
  await expect(page.getByLabel("Total", { exact: true })).toHaveValue("200");
  await page.getByRole("button", { name: "Save card", exact: true }).click();
  await expect(page.locator(".project-card")).toContainText("0 / 200");
  await expect(page.locator(".project-card")).toContainText("Read chapter one");
});

test("one-click capture saves a video timestamp and updates the same card on the next capture", async ({
  page,
}) => {
  await register(page);
  const capture = (time: string) =>
    `/?capture=tab&auto=1&title=Video%20checkpoint&url=${encodeURIComponent("https://www.youtube.com/watch?v=test-video&t=" + time + "s")}&checkpoint=${encodeURIComponent("00:01:30 / 00:10:00")}&resource=video`;
  await page.goto(capture("90"));
  await expect(page.locator(".project-card h2")).toHaveText("Video checkpoint");
  await expect(page).not.toHaveURL(/capture=/);
  await page.goto(capture("120"));
  await expect(page.locator(".project-card")).toHaveCount(1);
  await expect(page.locator('.project-card a[href*="t=120s"]')).toBeVisible();
});

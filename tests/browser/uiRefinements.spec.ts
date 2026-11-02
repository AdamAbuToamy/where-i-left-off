import { test, expect } from "@playwright/test";
import { prepareUniversityPilot } from "./universityFixture";
import { mkdir } from "node:fs/promises";
test("admin filters, larger week, tidy undated cards, university agenda and deleted-card history", async ({
  page,
  request,
}) => {
  test.setTimeout(90000);
  const { email, password } = await prepareUniversityPilot(request);
  await page.addInitScript(() => localStorage.setItem("language", "en"));
  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .locator("form")
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  await expect(page.locator(".side-navigation-toggle")).toBeVisible({
    timeout: 15000,
  });
  const skip = page.locator(".guide-skip");
  if (await skip.isVisible()) await skip.click();
  await page.goto("/#/admin");
  await page.goto("/#/personal");
  await page.getByRole("button", { name: "New card", exact: true }).click();
  await page
    .getByLabel("Card title", { exact: true })
    .fill("UI review fixture");
  await page
    .getByLabel("Next step", { exact: true })
    .fill("Check the next step");
  await page.getByRole("button", { name: "Save card", exact: true }).click();
  const card = page.locator(".project-card").filter({
    has: page.getByRole("heading", {
      name: "UI review fixture",
      exact: true,
    }),
  });
  await expect(card).toBeVisible();
  const choice = page.getByRole("combobox");
  await choice.click();
  await expect(page.getByRole("listbox")).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(choice).toHaveAttribute("aria-expanded", "false");
  await choice.press("Home");
  await choice.press("Enter");
  await page.locator(".workspace-tools-trigger").hover();
  await page.locator(".view-tabs button").nth(1).click();
  await expect(page.locator(".week-day")).toHaveCount(7);
  expect(
    Math.round((await page.locator(".week-day").first().boundingBox())!.height),
  ).toBeGreaterThanOrEqual(310);
  const undated = page.locator(".unscheduled-drawer");
  await expect(undated).toBeVisible();
  expect(await undated.evaluate((el) => (el as HTMLDetailsElement).open)).toBe(
    false,
  );
  await undated.locator("summary").click();
  await expect(undated.locator(".unscheduled-list")).toContainText(
    "UI review fixture",
  );
  await page.locator(".workspace-tools-trigger").hover();
  await page.locator(".view-tabs button").nth(0).click();
  await card.hover();
  await card.locator(".envelope-expand").click();
  await card.getByRole("button", { name: "Work session", exact: true }).click();
  const dialog = page.locator(".focus-dialog");
  await dialog.locator(".focus-checkpoint-details summary").click();
  await dialog
    .getByLabel("What did you finish? / Where did you stop?", { exact: true })
    .fill("Recorded review session");
  await dialog
    .getByRole("button", { name: "End session", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await page.goto("/#/analytics");
  await expect(
    page.locator(".session-history").filter({ hasText: "UI review fixture" }),
  ).toContainText("Recorded review session");
  await page.goto("/#/personal");
  await card.hover();
  await card.locator(".envelope-expand").click();
  await card.locator(".card-options summary").click();
  await card.getByRole("button", { name: "Delete", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete", exact: true })
    .click();
  await expect(card).toHaveCount(0);
  await page.goto("/#/analytics");
  await expect(page.locator(".analytics-page")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await expect(
    page.locator(".session-history").filter({ hasText: "UI review fixture" }),
  ).toHaveCount(0);
  await page
    .locator(".language-segments")
    .getByRole("button", { name: "العربية", exact: true })
    .click();
  await page.goto("/#/university");
  await expect(page.locator(".study-university-trial")).toBeVisible();
  await page.locator(".study-trial-tools summary").click();
  await page.locator(".study-upload input").setInputFiles({
    name: "ui-review.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        version: 1,
        courses: [
          {
            id: "ui-course",
            name: "كورس المراجعة",
            notes: "",
            url: "",
            requires: [],
            topics: [],
            x: 40,
            y: 40,
          },
        ],
        tasks: [],
        lessons: [
          {
            id: "ui-lesson",
            courseId: "ui-course",
            day: new Date().getDay(),
            start: "09:00",
            end: "10:00",
            room: "قاعة المراجعة",
            sessionType: "lecture",
            notes: "",
          },
        ],
      }),
    ),
  });
  await page
    .getByRole("button", { name: "تأكيد الإضافة", exact: true })
    .click();
  await page
    .getByRole("button", { name: "الجدول الأسبوعي", exact: true })
    .click();
  await page
    .locator(".study-trial-schedule .study-trial-actions")
    .getByRole("button", { name: "جدول اليوم", exact: true })
    .click();
  await expect(page.locator(".study-trial-lesson")).toContainText(
    "كورس المراجعة",
  );
  const day = page.locator(".study-trial-day").getByRole("combobox");
  await day.click();
  await expect(page.getByRole("listbox")).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(day).toHaveAttribute("aria-expanded", "false");
  await day.click();
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Enter");
  await expect(page.locator(".study-trial-lesson")).toBeVisible();
  await expect(page.locator(".study-trial-lesson")).toHaveCSS(
    "background-color",
    "rgb(255, 254, 250)",
  );
  await mkdir(".wrangler", { recursive: true });
  await page.screenshot({
    path: ".wrangler/ui-review-university-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({
    path: ".wrangler/ui-review-university-phone.png",
    fullPage: true,
  });
});

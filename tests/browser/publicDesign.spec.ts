import { test, expect } from "@playwright/test";
import { prepareUniversityPilot } from "./universityFixture";
for (const mobile of [false, true])
  test(`published design is the default for an ordinary account (${mobile ? "phone" : "desktop"})`, async ({
    page,
    request,
  }) => {
    const { email, password } = await prepareUniversityPilot(
      request,
      `public-design-${mobile ? "phone" : "desktop"}@example.test`,
    );
    await page.setViewportSize({ width: mobile ? 390 : 1440, height: 900 });
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
    await expect(page.locator("html")).toHaveAttribute(
      "data-design-preview",
      "on",
    );
    await expect(page.locator(".language-segments")).toBeVisible();
    await expect(page.locator(".design-preview-switch")).toHaveCount(0);
    await expect(
      page.locator('.page-navigation a[href="#/admin"]'),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "New card", exact: true }).click();
    await page
      .getByLabel("Card title", { exact: true })
      .fill("Published design card");
    await page
      .getByLabel("Next step", { exact: true })
      .fill("All original actions remain");
    await page.getByRole("button", { name: "Save card", exact: true }).click();
    const card = page
      .locator(".project-card")
      .filter({
        has: page.getByRole("heading", {
          name: "Published design card",
          exact: true,
        }),
      });
    await card.hover();
    await card.locator(".envelope-expand").click();
    await expect(
      card.getByRole("button", { name: "Work session", exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute(
      "data-design-preview",
      "on",
    );
    await expect(
      page.getByRole("heading", { name: "Published design card", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.goto("/#/admin");
    await expect(page.locator(".admin-dashboard")).toHaveCount(0);
    await expect(page.locator(".design-preview-switch")).toHaveCount(0);
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
    await expect(page.locator("html")).not.toHaveAttribute(
      "data-design-preview",
      "on",
    );
  });

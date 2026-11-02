import { test, expect } from "@playwright/test";
import { prepareUniversityPilot } from "./universityFixture";
import { mkdir } from "node:fs/promises";
for (const mobile of [false, true])
  test(`admin design preview ${mobile ? "phone" : "desktop"} keeps cards and reports in the final design`, async ({
    page,
    request,
  }) => {
    await page.setViewportSize(
      mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
    );
    const { email, password } = await prepareUniversityPilot(request);
    await page.addInitScript(() => {
      if (!localStorage.getItem("language"))
        localStorage.setItem("language", "en");
    });
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
    const skip = page.locator(".welcome-guide .guide-skip");
    if (await skip.isVisible()) await skip.click();
    await page.goto("/#/admin");
    await expect(page.locator("html")).toHaveAttribute(
      "data-design-preview",
      "on",
    );
    await page.goto("/#/personal");
    await page.getByRole("button", { name: "New card", exact: true }).click();
    await page
      .getByLabel("Card title", { exact: true })
      .fill(mobile ? "Glass mobile card" : "Glass desktop card");
    await page
      .getByLabel("Next step", { exact: true })
      .fill("All actions remain available");
    await page.getByRole("button", { name: "Save card", exact: true }).click();
    await expect(
      page.getByRole("heading", {
        name: mobile ? "Glass mobile card" : "Glass desktop card",
        exact: true,
      }),
    ).toBeVisible();
    await page.getByRole("button", { name: "View tools", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Cards", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Week", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Week", exact: true }).click();
    await expect(page.locator(".week-day")).toHaveCount(7);
    await page.getByRole("button", { name: "Cards", exact: true }).click();
    await expect(page.locator(".workspace-report")).toBeVisible();
    if (mobile) {
      await page.evaluate(() => {
        localStorage.setItem("language", "ar");
      });
      await page.reload();
      await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    }
    await expect(page.locator("html")).toHaveAttribute(
      "data-design-preview",
      "on",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await mkdir(".wrangler", { recursive: true });
    await page.screenshot({
      path: `.wrangler/design-preview-${mobile ? "phone" : "desktop"}.png`,
      fullPage: true,
    });
    await page.emulateMedia({ reducedMotion: "reduce" });
    expect(
      await page
        .locator(".account-page-outlet")
        .evaluate((el) => getComputedStyle(el).animationName),
    ).toBe("none");
    await page.goto("/#/admin");
    await expect(page.locator(".design-preview-switch")).toHaveCount(0);
    await expect(page.locator("html")).toHaveAttribute(
      "data-design-preview",
      "on",
    );
    await page.goto("/#/personal");
    await expect(page.locator(".project-card")).not.toHaveCount(0);
    await expect(page.locator("html")).toHaveAttribute(
      "data-design-preview",
      "on",
    );
  });

import { test, expect } from "@playwright/test";
import { prepareUniversityPilot } from "./universityFixture";
for (const language of ["en", "ar"])
  test(`menu remains open while crossing the gap (${language})`, async ({
    page,
    request,
  }) => {
    const { email, password } = await prepareUniversityPilot(request);
    await page.addInitScript(() => localStorage.setItem("language", "en"));
    await page.goto("/");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.locator(".auth-journey .auth-continue").click(); await page.getByLabel("Password", { exact: true }).fill(password);
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
    if (language === "ar")
      await page
        .locator(".language-segments")
        .getByRole("button", { name: "العربية", exact: true })
        .click();
    const toggle = page.locator(".side-navigation-toggle");
    await toggle.hover();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    const box = (await toggle.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height + 5, {
      steps: 12,
    });
    // Assert while stationary in the actual gap, not via locator.hover() teleportation.
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await page.locator('.page-navigation a[href="#/settings"]').hover();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await page.mouse.move(700, 700, { steps: 12 });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.hover();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height + 5, {
      steps: 12,
    });
    await page.locator('.page-navigation a[href="#/university"]').click();
    await expect(page.locator(".study-page")).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

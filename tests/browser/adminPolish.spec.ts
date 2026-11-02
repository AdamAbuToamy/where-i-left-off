import { test, expect } from "@playwright/test";
import { prepareUniversityPilot } from "./universityFixture";
import { mkdir } from "node:fs/promises";
for (const mobile of [false, true])
  test(`admin screenshot fixes ${mobile ? "phone RTL" : "desktop"}`, async ({
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
    const skip = page.locator(".guide-skip");
    if (await skip.isVisible()) await skip.click();
    await page.goto("/#/admin");
    if (
      await page
        .getByRole("button", { name: "Use current design", exact: true })
        .isVisible()
    )
      await page
        .getByRole("button", { name: "Use current design", exact: true })
        .click();
    await page
      .getByRole("link", { name: "Explore site", exact: false })
      .click();
    await page.getByRole("button", { name: "New card", exact: true }).click();
    await page
      .getByLabel("Card title", { exact: true })
      .fill("Screenshot polish");
    await page
      .getByLabel("Next step", { exact: true })
      .fill("Keep all existing controls");
    await page.getByRole("button", { name: "Save card", exact: true }).click();
    await expect(
      page
        .getByRole("heading", { name: "Screenshot polish", exact: true })
        .first(),
    ).toBeVisible();
    if (mobile) {
      await page.evaluate(() => localStorage.setItem("language", "ar"));
      await page.reload();
      await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    }
    async function settled() {
      await page.evaluate(async () => {
        window.scrollTo(0, 0);
        await Promise.all(
          document
            .getAnimations()
            .filter(
              (a) => a.effect?.getComputedTiming().iterations !== Infinity,
            )
            .map((a) => a.finished.catch(() => {})),
        );
      });
    }
    await mkdir(".wrangler", { recursive: true });
    const suffix = mobile ? "phone" : "desktop";
    const tools = page.locator(".workspace-tools-trigger");
    await tools.hover();
    await expect(tools).toHaveAttribute("aria-expanded", "true");
    await expect(
      page.locator(".workspace-tools-panel .view-tabs button"),
    ).toHaveCount(2);
    await settled();
    await page.screenshot({
      path: `.wrangler/polish-search-${suffix}.png`,
      fullPage: true,
    });
    await page.goto("/#/library");
    await expect(page.locator(".workflow-tabs")).toBeVisible();
    expect(
      await page
        .locator(".workflow-tabs")
        .evaluate((el) => getComputedStyle(el).backgroundColor),
    ).toBe("rgba(0, 0, 0, 0)");
    await settled();
    await page.screenshot({
      path: `.wrangler/polish-library-${suffix}.png`,
      fullPage: true,
    });
    await page.goto("/#/groups");
    await expect(page.locator(".group-create")).toHaveCount(2);
    expect(
      await page
        .locator(".group-create summary")
        .first()
        .evaluate((el) => getComputedStyle(el).listStyleType),
    ).toBe("none");
    await settled();
    await page.screenshot({
      path: `.wrangler/polish-groups-${suffix}.png`,
      fullPage: true,
    });
    await page.goto("/#/university");
    await expect(page.locator(".study-toolbar")).toBeVisible();
    expect(
      await page
        .locator(".study-toolbar")
        .evaluate((el) => getComputedStyle(el).backgroundColor),
    ).toBe("rgba(0, 0, 0, 0)");
    await page.locator(".study-tabs button").nth(1).click();
    await expect(page.locator(".study-toolbar select")).toBeVisible();
    expect(
      (await page.locator(".study-toolbar select").boundingBox())!.height,
    ).toBeLessThan(80);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await settled();
    await page.screenshot({
      path: `.wrangler/polish-university-${suffix}.png`,
      fullPage: true,
    });
    await page.goto("/#/admin");
    await expect(page.locator(".admin-account").first()).toBeVisible();
    await expect(page.locator(".preview-account-dates").first()).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: mobile ? "نشاط الحساب" : "Account activity",
        exact: true,
      }),
    ).toHaveCount(0);
  });

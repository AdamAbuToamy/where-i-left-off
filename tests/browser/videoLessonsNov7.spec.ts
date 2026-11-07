import { test, expect } from "@playwright/test";
import { prepareUniversityPilot } from "./universityFixture";
for (const phone of [false, true])
  test.describe(phone ? "phone" : "desktop", () => {
    test.use({
      viewport: phone
        ? { width: 390, height: 844 }
        : { width: 1440, height: 1000 },
      isMobile: phone,
      hasTouch: phone,
    });
    test("shows an honest loading preview, then creates a card with only its title", async ({
      page,
      request,
    }) => {
      const language = phone ? "ar" : "en",
        c = await prepareUniversityPilot(
          request,
          `video-lessons-${phone}@example.test`,
        );
      await page.addInitScript(
        ({ uid, language }) => {
          localStorage.setItem("language", language);
          localStorage.setItem("welcome-tour:v2:" + uid, "done");
        },
        { uid: c.uid, language },
      );
      let release: () => void = () => {};
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      await page.route("**/assets/Workspace-*.js", async (route) => {
        await gate;
        await route.continue();
      });
      await page.goto("/");
      await page.locator('input[type="email"]').fill(c.email);
      await page.locator('input[type="password"]').fill(c.password);
      await page
        .locator("form")
        .getByRole("button", {
          name: phone ? "تسجيل الدخول" : "Sign in",
          exact: true,
        })
        .click();
      const skeleton = page.locator(".content-skeleton").first();
      await expect(skeleton).toBeVisible();
      await expect(skeleton).toHaveAttribute("aria-busy", "true");
      expect(await skeleton.locator("button,input,a").count()).toBe(0);
      await page.screenshot({
        path: `.wrangler/nov7-skeleton-${language}.png`,
        animations: "disabled",
      });
      release();
      await expect(page.locator('[data-tour="add-project"]')).toBeVisible({
        timeout: 15000,
      });
      await page.locator('[data-tour="add-project"]').click();
      const form = page.locator(".new-project-form");
      await expect(form).toBeVisible();
      await form.locator("#project-name").fill("Video lessons card");
      await expect(form.locator("#new-description")).not.toBeVisible();
      await page.screenshot({
        path: `.wrangler/nov7-new-card-${language}.png`,
        animations: "disabled",
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
      await form.locator('[data-tour="save-project"]').click();
      await expect(
        page.locator(".project-card").filter({ hasText: "Video lessons card" }),
      ).toHaveCount(1);
      await expect
        .poll(
          async () => {
            const cards = await request.get(
              `http://127.0.0.1:8080/v1/projects/demo-where-i-left-off/databases/(default)/documents/users/${c.uid}/projects`,
              { headers: { Authorization: "Bearer owner" } },
            );
            expect(cards.ok()).toBe(true);
            return ((await cards.json()).documents || []).length;
          },
          { timeout: 15000 },
        )
        .toBe(1);
    });
  });

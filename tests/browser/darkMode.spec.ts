import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { prepareUniversityPilot } from "./universityFixture";
for (const phone of [false, true])
  test(`dark mode, settings and account pages ${phone ? "phone" : "desktop"}`, async ({
    page,
    request,
  }) => {
    const account = await prepareUniversityPilot(
      request,
      `dark-${phone}@example.test`,
    );
    await page.setViewportSize(
      phone ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
    );
    await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
    await page.addInitScript((uid) => {
      localStorage.setItem("language", "en");
      localStorage.setItem("welcome-tour:v2:" + uid, "done");
      localStorage.setItem(
        "wilo-experience:v1:" + uid,
        JSON.stringify({ motion: false, sound: false }),
      );
    }, account.uid);
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute(
      "data-color-scheme",
      "dark",
    );
    await page.getByLabel("Email", { exact: true }).fill(account.email);
    await page.locator(".auth-continue").click();
    await page.getByLabel("Password", { exact: true }).fill(account.password);
    await page
      .locator("form")
      .getByRole("button", { name: "Sign in", exact: true })
      .click();
    await expect(
      page.locator(
        phone ? ".mobile-bottom-navigation" : ".side-navigation-toggle",
      ),
    ).toBeVisible({ timeout: 15000 });
    await page.goto("/#/settings");
    const appearance = page
      .locator(".settings-group")
      .filter({ has: page.locator(".color-mode-options") })
      .first();
    const mode = page.getByRole("group", { name: "Color mode", exact: true });
    if (!(await mode.isVisible())) await appearance.locator("summary").click();
    await mode.getByRole("button", { name: "Light", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute(
      "data-color-scheme",
      "light",
    );
    await mode.getByRole("button", { name: "Dark", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute(
      "data-color-scheme",
      "dark",
    );
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute(
      "data-color-scheme",
      "dark",
    );
    for (const route of [
      "personal",
      "university",
      "groups",
      "notifications",
      "api-docs",
    ]) {
      await page.goto("/#/" + route);
      await expect(page.locator("html")).toHaveAttribute(
        "data-color-scheme",
        "dark",
      );
      await expect(page.locator("#wilo-main")).toBeVisible();
      await expect(page.locator(".content-skeleton")).toHaveCount(0);
      expect(
        await page.evaluate(
          () => getComputedStyle(document.body).backgroundColor,
        ),
      ).toBe("rgb(20, 28, 25)");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `/tmp/wilo-dark-${route}-${phone ? "phone" : "desktop"}.png`,
      });
    }
    await page.goto("/#/personal");
    const result = await new AxeBuilder({ page })
      .include("#wilo-main")
      .withRules(["color-contrast"])
      .analyze();
    expect(result.violations).toEqual([]);
  });
test("system mode responds live and saved dark mode styles bootstrap before JavaScript", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute(
    "data-color-scheme",
    "light",
  );
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute(
    "data-color-scheme",
    "dark",
  );
  await page.addInitScript(() =>
    localStorage.setItem("site-color-mode", "dark"),
  );
  let release!: () => void;
  const pending = new Promise<void>((resolve) => (release = resolve));
  await page.route(/\/assets\/index-[^/]+\.js$/, async (route) => {
    await pending;
    await route.continue();
  });
  try {
    await page.goto("/", { waitUntil: "commit" });
    await expect(page.locator("#wilo-bootstrap")).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute(
      "data-color-scheme",
      "dark",
    );
    expect(
      await page.evaluate(() =>
        getComputedStyle(document.documentElement)
          .getPropertyValue("--site-bg")
          .trim(),
      ),
    ).toBe("#141c19");
  } finally {
    release();
  }
});

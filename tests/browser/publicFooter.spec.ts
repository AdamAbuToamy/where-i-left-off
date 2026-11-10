import { test, expect } from "@playwright/test";
for (const language of ["en", "ar", "he"] as const)
  for (const phone of [false, true])
    test(`public identity footer and recovered guide ${language} ${phone ? "phone" : "desktop"}`, async ({
      page,
    }) => {
      await page.setViewportSize(
        phone ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
      );
      await page.addInitScript(
        (language) => localStorage.setItem("language", language),
        language,
      );
      await page.goto("/");
      const footer = page.locator("#wilo-site-identity");
      await footer.scrollIntoViewIfNeeded();
      await expect(footer).toBeVisible();
      await expect(
        footer.getByText("Where I Left Off", { exact: true }),
      ).toBeVisible();
      const links = footer.locator(`a[data-footer-locale="${language}"]`);
      await expect(links).toHaveCount(3);
      await expect(links.first()).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `/tmp/wilo-restored-footer-${language}-${phone ? "phone" : "desktop"}.png`,
        animations: "disabled",
      });
      await links.first().click();
      await expect(page).toHaveURL(
        new RegExp(
          language === "en" ? "/about.html" : "/about-" + language + ".html",
        ),
      );
      await expect(page.locator("main h1")).toBeVisible();
      await expect(page.locator(".project-card")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.locator(".project-card").hover();
      await page.locator(".envelope-expand").click();
      await expect(page.locator(".envelope-content")).toBeVisible();
      await page.locator(".envelope-collapse").click();
      await expect(page.locator(".envelope-content")).toBeHidden();
    });

test("loading hides both footer areas and restores them when ready", async ({
  page,
}) => {
  let release!: () => void;
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/assets/*.js", async (route) => {
    await ready;
    await route.continue();
  });
  try {
    await page.goto("/", { waitUntil: "commit" });
    await expect(page.locator("#wilo-bootstrap")).toBeVisible();
    await expect(page.locator("#wilo-site-identity")).not.toBeVisible();
  } finally {
    release();
  }
  await expect(page.locator("#wilo-bootstrap")).toHaveCount(0);
  await expect(page.locator("#wilo-site-identity")).toBeVisible();
  await expect(page.locator(".site-footer")).toBeVisible();
  await page.evaluate(() => {
    const loader = document.createElement("section");
    loader.className = "wilo-loading";
    loader.id = "test-loading";
    loader.textContent = "Getting your space ready";
    document.querySelector("#root")!.append(loader);
  });
  await expect(page.locator("#wilo-site-identity")).not.toBeVisible();
  await expect(page.locator(".site-footer")).not.toBeVisible();
  await page.evaluate(() => document.querySelector("#test-loading")!.remove());
  await expect(page.locator("#wilo-site-identity")).toBeVisible();
  await expect(page.locator(".site-footer")).toBeVisible();
});

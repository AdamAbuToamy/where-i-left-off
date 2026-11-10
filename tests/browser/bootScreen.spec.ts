import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";

test("shows a localized critical loader before the entry script arrives and replaces it when ready", async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem("language", "ar"));
  let release!: () => void;
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(/\/assets\/index-[^/]+\.js$/, async (route) => {
    await blocked;
    await route.continue();
  });
  try {
    await page.goto("/", { waitUntil: "commit" });
    const boot = page.locator("#wilo-bootstrap");
    await expect(boot).toBeVisible();
    await expect(boot.getByRole("heading")).toHaveText("نجهّز مساحتك");
    await expect(boot.getByRole("status")).toHaveText("جارٍ تحميل مشاريعك…");
    await expect(page.locator('[data-loading-locale="en"]')).toBeHidden();
    await expect(
      page.getByText("A project organizer for your current state", {
        exact: false,
      }),
    ).toHaveCount(0);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const loader = boot.locator(".wilo-loading:visible");
    await expect(loader).toHaveCSS("position", "fixed");
    const before = await loader.boundingBox();
    expect(before!.y).toBe(0);
    expect(Math.abs(before!.height - 844)).toBeLessThan(2);
    await page.evaluate(() => {
      const header = document.createElement("header"); header.id = "late-header"; header.style.height = "180px"; header.textContent = "Where I Left Off"; document.body.prepend(header);
    });
    expect(await loader.boundingBox()).toEqual(before);
    await page.evaluate(() => document.querySelector("#late-header")!.remove());
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(boot.locator(".wilo-loading-card-front:visible")).toHaveCSS(
      "animation-name",
      "none",
    );
    await mkdir(".wrangler", { recursive: true });
    await page.screenshot({ path: ".wrangler/boot-screen-phone.png" });
  } finally {
    release();
  }
  await expect(page.locator("#wilo-bootstrap")).toHaveCount(0, {
    timeout: 15000,
  });
  await expect(
    page.getByLabel("البريد الإلكتروني", { exact: true }),
  ).toBeVisible();
});

test("provides a useful fallback without JavaScript instead of an endless loader", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto("/");
    await page.screenshot({ path: ".wrangler/boot-noscript.png" });
    await expect(page.locator("#wilo-bootstrap")).toBeHidden();
    await expect(page.locator(".wilo-no-script p").first()).toBeVisible();
    await expect(page.locator(".wilo-no-script p").first()).toHaveText(
      "Enable JavaScript to open your workspace.",
    );
    await expect(page.locator(".wilo-no-script a")).toHaveAttribute(
      "href",
      "/about.html",
    );
  } finally {
    await context.close();
  }
});

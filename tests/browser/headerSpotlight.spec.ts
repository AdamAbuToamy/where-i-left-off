import { test, expect } from "@playwright/test";
import { prepareUniversityPilot } from "./universityFixture";
import { mkdir } from "node:fs/promises";
test("admin header automatically cycles while hovered with no play button", async ({
  page,
  request,
}) => {
  test.setTimeout(60000);
  const { email, password } = await prepareUniversityPilot(request);
  await page.addInitScript(() => {
    localStorage.setItem("language", "en");
    window.addEventListener(
      "beforeinstallprompt",
      (event) => event.stopImmediatePropagation(),
      true,
    );
  });
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
  await expect(page.locator("[data-face=brand]")).toBeVisible();
  const title = (await page.locator(".brand-spotlight").boundingBox())!,
    header = (await page.locator(".page-header").boundingBox())!;
  expect(
    Math.abs(title.x + title.width - header.x - header.width),
  ).toBeLessThan(3);
  await expect(page.locator(".brand-motion-toggle")).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".brand-spotlight")).toBeVisible();
  await expect(page.locator(".page-header")).toHaveCSS(
    "background-color",
    "rgba(0, 0, 0, 0)",
  );
  await page.locator(".brand-spotlight").hover();
  await expect(page.locator("[data-face=app]")).toBeVisible({ timeout: 19000 });
  await expect(page.locator("[data-face=brand]")).toBeVisible({
    timeout: 19000,
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("[data-face=brand]")).toHaveCount(0, {
    timeout: 19000,
  });
  await expect(page.locator(".brand-motion-toggle")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await mkdir(".wrangler", { recursive: true });
  await page.screenshot({
    path: ".wrangler/header-auto-phone.png",
    fullPage: true,
  });
});

import { test, expect } from "@playwright/test";
import { prepareUniversityPilot } from "./universityFixture";
import { mkdir } from "node:fs/promises";
test("admin header alignment, timed 3D promotion, install guide and pause", async ({
  page,
  request,
}) => {
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
  await page
    .getByRole("button", { name: "Enable preview", exact: true })
    .click();
  await expect(page.locator("[data-face=brand]")).toBeVisible();
  const title = (await page.locator(".brand-spotlight").boundingBox())!,
    header = (await page.locator(".page-header").boundingBox())!;
  expect(
    Math.abs(title.x + title.width - header.x - header.width),
  ).toBeLessThan(3);
  await page.mouse.move(0, 0);
  await expect(
    page.getByRole("button", { name: "Install the app", exact: false }),
  ).toBeVisible({ timeout: 16000 });
  await page
    .getByRole("button", { name: "Install the app", exact: false })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText("Add to Home Screen");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page
    .getByRole("button", { name: "Pause title animation", exact: true })
    .click();
  await page.mouse.move(0, 0);
  await expect(
    page.getByRole("button", { name: "Resume title animation", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("[data-face=app]")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await mkdir(".wrangler", { recursive: true });
  await page.screenshot({
    path: ".wrangler/header-spotlight-phone.png",
    fullPage: true,
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("[data-face=brand]")).toBeVisible();
  await expect(page.locator(".brand-motion-toggle")).toHaveCount(0);
});

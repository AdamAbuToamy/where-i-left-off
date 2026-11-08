import { test, expect } from "@playwright/test";
import { prepareUniversityPilot } from "./universityFixture";
import { mkdir, writeFile } from "node:fs/promises";

test("loads pages on demand and offers direct language choices only for the admin design", async ({
  page,
  request,
}) => {
  const { email, password } = await prepareUniversityPilot(request);
  const scripts: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (req) => {
    if (req.resourceType() === "script")
      scripts.push(new URL(req.url()).pathname);
  });
  await page.addInitScript(() => localStorage.setItem("language", "en"));
  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.locator(".auth-journey .auth-continue").click(); await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .locator("form")
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "New card", exact: true }),
  ).toBeVisible({ timeout: 15000 });
  const skip = page.locator(".guide-skip");
  if (await skip.isVisible()) await skip.click();
  expect(scripts.some((url) => /AdminDashboard-/.test(url))).toBe(false);
  expect(scripts.some((url) => /ProfileSettings-/.test(url))).toBe(false);
  const initialScripts = [...scripts];
  await page.goto("/#/admin");
  const choices = page.locator(".language-segments");
  await expect(choices.getByRole("button")).toHaveCount(3);
  await choices.getByRole("button", { name: "العربية", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(
    choices.getByRole("button", { name: "العربية", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await choices.getByRole("button", { name: "עברית", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("html")).toHaveAttribute("lang", "he");
  await choices.getByRole("button", { name: "English", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await mkdir(".wrangler", { recursive: true });
  await page.screenshot({
    path: ".wrangler/video-lessons-phone.png",
    fullPage: true,
  });
  await page.goto("/#/settings");
  await expect(page.locator(".settings-page")).toBeVisible();
  expect(scripts.some((url) => /ProfileSettings-/.test(url))).toBe(true);
  await page.goto("/#/admin");
  await expect(page.locator(".design-preview-switch")).toHaveCount(0);
  await expect(page.locator(".language-segments")).toBeVisible();
  expect(errors).toEqual([]);
  await writeFile(
    ".wrangler/video-lessons-browser-proof.json",
    JSON.stringify(
      {
        initialScripts,
        routeScripts: scripts,
        pageErrors: errors,
        account: "disposable-emulator-only",
      },
      null,
      2,
    ),
  );
});

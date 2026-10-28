import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";
export async function setup(page: Page) {
  await page.addInitScript(
    () =>
      localStorage.getItem("language") ||
      localStorage.setItem("language", "en"),
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page
    .getByLabel("Personal name", { exact: true })
    .fill("Session tester");
  await page
    .getByLabel("Email", { exact: true })
    .fill(`voice-${Date.now()}@example.test`);
  await page.getByLabel("Password", { exact: true }).fill("Test-Password-2026");
  await page
    .locator("form")
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.locator(".side-navigation-toggle")).toBeVisible();
  const skip = page.locator(".welcome-guide .guide-skip");
  if (await skip.isVisible()) await skip.click();
  await expect(page.locator(".welcome-guide")).toHaveCount(0);
  await page.getByRole("button", { name: "New card", exact: true }).click();
  await page
    .getByLabel("Card title", { exact: true })
    .fill("Voice session project");
  await page.getByLabel("Next step", { exact: true }).fill("Check login");
  await page.getByRole("button", { name: "Save card", exact: true }).click();
  await expect(page.locator(".sync-status")).toHaveText(
    "Synced with your account",
  );
  await page.getByRole("button", { name: "Work session", exact: true }).click();
  await expect(page.locator("[data-session-sync=ready]")).toBeVisible();
}

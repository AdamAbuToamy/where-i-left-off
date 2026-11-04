import { test, expect } from "@playwright/test";
import { prepareUniversityPilot } from "./universityFixture";
async function login(
  page: import("@playwright/test").Page,
  email: string,
  password: string,
  uid: string,
) {
  await page.addInitScript((uid) => {
    localStorage.setItem("language", "en");
    localStorage.setItem("welcome-tour:v2:" + uid, "done");
  }, uid);
  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .locator("form")
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  await expect(page.locator(".side-navigation")).toBeVisible({
    timeout: 15000,
  });
}
test("admin captures and converts an inbox item once; account restore retains the Inbox", async ({
  page,
  request,
  browser,
}) => {
  test.setTimeout(90000);
  const c = await prepareUniversityPilot(request);
  await login(page, c.email, c.password, c.uid);
  await page.getByRole("button", { name: "Work hub", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Work hub", exact: true });
  await dialog
    .getByLabel("Quick idea", { exact: true })
    .fill("Captured research");
  await dialog
    .getByLabel("Optional link", { exact: true })
    .fill("https://example.com/research");
  await dialog
    .getByRole("button", { name: "Save to Inbox", exact: true })
    .click();
  await expect(dialog.locator(".pilot-list")).toContainText(
    "Captured research",
  );
  await expect(dialog.locator("header [role=status]")).toHaveText(
    "Saved to account",
    { timeout: 15000 },
  );
  await dialog
    .getByRole("button", { name: "Make a card", exact: true })
    .click();
  await expect(dialog.locator(".pilot-list article")).toHaveCount(0);
  await dialog.getByLabel("Close work hub", { exact: true }).click();
  await page.goto("/#/personal");
  await expect(
    page
      .locator(".envelope-summary h2")
      .filter({ hasText: "Captured research" }),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "Work hub", exact: true }).click();
  await dialog
    .getByLabel("Quick idea", { exact: true })
    .fill("Still in my inbox");
  await dialog
    .getByRole("button", { name: "Save to Inbox", exact: true })
    .click();
  await expect(dialog.locator("header [role=status]")).toHaveText(
    "Saved to account",
    { timeout: 15000 },
  );
  const fresh = await browser.newContext();
  const other = await fresh.newPage();
  await login(other, c.email, c.password, c.uid);
  await other.getByRole("button", { name: "Work hub", exact: true }).click();
  await expect(other.locator(".pilot-list")).toContainText(
    "Still in my inbox",
    { timeout: 15000 },
  );
  await fresh.close();
});
test("ordinary accounts do not receive the Work hub", async ({
  page,
  request,
}) => {
  const c = await prepareUniversityPilot(request, "ordinary-hub@example.test");
  await login(page, c.email, c.password, c.uid);
  await expect(
    page.getByRole("button", { name: "Work hub", exact: true }),
  ).toHaveCount(0);
});

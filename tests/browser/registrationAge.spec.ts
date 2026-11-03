import { test, expect } from "@playwright/test";
test("age choice precedes new-account details and existing email sign-in remains accessible", async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem("language", "en"));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByLabel("Age group", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Email", { exact: true })).toHaveCount(0);
  await page.getByLabel("Age group", { exact: true }).selectOption("under16");
  await expect(page.getByRole("status")).toContainText(
    "New accounts are available",
  );
  await expect(page.getByLabel("Email", { exact: true })).toHaveCount(0);
  await expect(
    page
      .locator("form")
      .getByRole("button", { name: "Create account", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Age group", { exact: true }).selectOption("16plus");
  await expect(page.getByLabel("Personal name", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).filter((key) =>
        /birth|age.?band|age.?group/i.test(key),
      ),
    ),
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .locator(".form-actions")
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  await expect(page.getByLabel("Age group", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
  await page.screenshot({ path: ".wrangler/registration-privacy-phone.png" });
});

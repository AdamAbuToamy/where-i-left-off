import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { ADMIN_EMAIL as admin } from "../../src/lib/admin";
// Disposable emulator-only credentials; never reuse a real account password.
const password = randomUUID();
test("personal university pilot: edit, graph, timetable and reload", async ({
  page,
  request,
}) => {
  const signup = await request.post(
    "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key",
    { data: { email: admin, password, returnSecureToken: true } },
  );
  expect(signup.ok()).toBe(true);
  const account = await signup.json();
  const verified = await request.post(
    "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:update?key=demo-key",
    {
      headers: { Authorization: "Bearer owner" },
      data: {
        localId: account.localId,
        emailVerified: true,
        displayName: "University pilot",
      },
    },
  );
  expect(verified.ok()).toBe(true);
  await page.addInitScript(() => localStorage.setItem("language", "en"));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill(admin);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .locator("form")
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  await expect(page.locator(".side-navigation-toggle")).toBeVisible();
  const skip = page.locator(".welcome-guide .guide-skip");
  if (await skip.isVisible()) await skip.click();
  await page.goto("/#/university");
  await expect(
    page.getByText("BGU · مساحة الجامعة · تجربة شخصية", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "+ كورس", exact: true }).click();
  await page.getByLabel("اسم الكورس", { exact: true }).fill("Algorithms");
  await page
    .getByLabel("ملاحظات الكورس", { exact: true })
    .fill("Review proofs");
  await page.getByRole("button", { name: "حفظ", exact: true }).click();
  await page
    .getByRole("button", { name: "+ وظيفة أو مهمة", exact: true })
    .click();
  await page.getByLabel("العنوان", { exact: true }).fill("Exercise 1");
  await page
    .getByLabel("الموعد والساعة", { exact: true })
    .fill("2026-11-10T14:30");
  await page.getByRole("button", { name: "حفظ", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Exercise 1", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "מערכת שעות · الجدول", exact: true })
    .click();
  await page
    .getByRole("button", { name: "+ محاضرة / تمرين", exact: true })
    .click();
  await page.getByLabel("المكان / القاعة", { exact: true }).fill("Building 90");
  await page.getByRole("button", { name: "حفظ", exact: true }).click();
  await expect(page.locator(".study-lesson")).toContainText("Building 90");
  await page
    .getByRole("button", { name: "خريطة الكورسات", exact: true })
    .click();
  await expect(page.locator(".study-node")).toContainText("Algorithms");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "الكورسات والمهام", exact: true })
    .click();
  await page.screenshot({
    path: "test-results/university-review/mobile.png",
    fullPage: true,
  });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Exercise 1", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Review proofs", { exact: true })).toBeVisible();
});

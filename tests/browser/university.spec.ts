import { test, expect } from "@playwright/test";
import { prepareUniversityPilot } from "./universityFixture";
test("semester planner: edit, checklist, graph, timetable and reload", async ({
  page,
  request,
}) => {
  const { email: admin, password } = await prepareUniversityPilot(request);
  await page.addInitScript(() => { if (!localStorage.getItem("language")) localStorage.setItem("language", "en"); });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/push-config.json',route=>route.fulfill({status:503,body:'{}'}));
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
  await expect(page.getByText("My study space", { exact: true })).toBeVisible();
  await page.locator(".language-trigger").click();
  await page.getByRole("button", { name: "العربية", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.getByText("مساحتي الدراسية", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.getByText("مساحتي الدراسية", { exact: true })).toBeVisible();
  await page.locator(".study-toolbar").getByRole("button", { name: "إضافة كورس", exact: true }).click();
  await page.getByLabel("اسم الكورس", { exact: true }).fill("Algorithms");
  await page
    .getByLabel("ملاحظات الكورس", { exact: true })
    .fill("Review proofs");
  await page.getByLabel("خطة الدراسة — موضوع في كل سطر", { exact: true }).fill("Proofs\nGraphs");
  await page.getByRole("button", { name: "حفظ", exact: true }).click();
  await page.getByRole("checkbox", { name: "Proofs", exact: true }).check();
  await page.getByRole("button", { name: "إضافة مهمة", exact: true }).click();
  await page.getByLabel("العنوان", { exact: true }).fill("Exercise 1");
  await page
    .getByLabel("التاريخ والوقت", { exact: true })
    .fill("2026-11-10T14:30");
  await page.getByRole("button", { name: "حفظ", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Exercise 1", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "الجدول الأسبوعي", exact: true })
    .click();
  await page.getByRole("button", { name: "إضافة محاضرة", exact: true }).click();
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
    path: "test-results/layout-review/university-mobile.png",
    fullPage: true,
  });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Exercise 1", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Review proofs", { exact: true })).toBeVisible();
  await expect(page.getByRole("checkbox",{name:"Proofs",exact:true})).toBeChecked();
  await expect(page.getByText("Moodle",{exact:true})).toHaveCount(0);
});

import { test, expect } from "@playwright/test";
import { pilot } from "./productivityFixture";
test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});
test("admin hub fits an Arabic phone without loading the desktop planning canvas", async ({
  page,
  request,
}) => {
  const loaded: string[] = [];
  page.on("request", (r) => loaded.push(r.url()));
  await pilot(page, request, ["Mobile card"]);
  await page.getByRole("button", { name: "العربية", exact: true }).click();
  await page.getByRole("button", { name: "مركز العمل", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "مركز العمل", exact: true });
  await expect(dialog).toBeVisible();
  const bounds = await dialog.boundingBox();
  expect(bounds).toBeTruthy();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  await dialog.getByRole("tab", { name: "وقت العمل", exact: true }).click();
  await expect(dialog.locator(".pilot-panel")).toBeVisible();
  await page.screenshot({ path: ".wrangler/ten-mobile.png", fullPage: true });
  expect(
    loaded.some((url) => /PlanningBoardDialog|PlanningBoardExport/.test(url)),
  ).toBe(false);
  await dialog.getByLabel("إغلاق مركز العمل", { exact: true }).click();
  await expect(dialog).toHaveCount(0);
});

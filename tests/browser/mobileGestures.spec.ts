import { test, expect } from "@playwright/test";
test.describe("phone gestures", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  test("pull refresh works and left-edge swipe leaves navigation unchanged", async ({
    page,
    context,
  }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveClass(/wilo-phone-gestures/);
    const cdp = await context.newCDPSession(page);
    const send = (type: string, x: number, y: number) =>
      cdp.send("Input.dispatchTouchEvent", {
        type,
        touchPoints: type === "touchEnd" ? [] : [{ x, y }],
      });
    await send("touchStart", 180, 55);
    for (let y = 70; y <= 330; y += 20) await send("touchMove", 180, y);
    await expect(page.locator(".wilo-refresh")).toHaveAttribute(
      "data-visible",
      "true",
    );
    await page.screenshot({ path: "/tmp/wilo-mobile-pull-refresh.png" });
    const reload = page.waitForEvent("domcontentloaded");
    await send("touchEnd", 180, 330);
    await reload;
    await expect(page.locator(".wilo-refresh")).toHaveAttribute(
      "data-visible",
      "false",
    );
    await page.evaluate(() => {
      location.hash = "/support";
    });
    await expect(page).toHaveURL(/support/);
    await page.evaluate(() => {
      location.hash = "/personal";
    });
    await expect(page).toHaveURL(/personal/);
    await send("touchStart", 8, 70);
    for (let x = 20; x <= 120; x += 15) await send("touchMove", x, 72);
    await send("touchEnd", 120, 72);
    await expect(page).toHaveURL(/personal/);
  });
});
test("desktop keeps native layout and does not enable phone gestures", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("html")).not.toHaveClass(/wilo-phone-gestures/);
  await expect(page.locator(".wilo-refresh")).not.toBeVisible();
});

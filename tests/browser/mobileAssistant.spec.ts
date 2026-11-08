import { test, expect } from "@playwright/test";
import { prepareUniversityPilot } from "./universityFixture";
import type { Page, APIRequestContext } from "@playwright/test";
import { mkdir } from "node:fs/promises";
async function signIn(page: Page, request: APIRequestContext, email: string) {
  const user = await prepareUniversityPilot(request, email);
  await page.addInitScript((uid) => {
    localStorage.setItem("language", "en");
    sessionStorage.setItem(
      "wilo-pollinations:" + uid,
      "sk_synthetic_mobile_test",
    );
  }, user.uid);
  await page.route("https://gen.pollinations.ai/**", async (route) => {
    const payload = route.request().postDataJSON();
    const routing = payload.tools?.some(
      (tool: { function: { name: string } }) =>
        tool.function.name === "request_workspace",
    );
    const name = routing ? "request_workspace" : "create_card";
    const args = routing
      ? { requirements: [] }
      : { name: "Mobile peek card", alias: "mobile-card" };
    await route.fulfill({
      json: {
        choices: [
          {
            message: {
              tool_calls: [
                {
                  id: "mobile-call",
                  type: "function",
                  function: { name, arguments: JSON.stringify(args) },
                },
              ],
            },
          },
        ],
      },
    });
  });
  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.locator(".auth-journey .auth-continue").click(); await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page
    .locator("form")
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  await expect(page.locator(".side-navigation-toggle")).toBeVisible({
    timeout: 15000,
  });
  const skip = page.locator(".guide-skip");
  if (await skip.isVisible()) await skip.click();
  return user;
}
test.describe("phone assistant", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  test("touch drag snaps to all edges, persists, fills viewport and briefly reveals a confirmed change", async ({
    page,
    request,
    context,
  }) => {
    test.setTimeout(90000);
    await signIn(page, request, "mobile-assistant@example.test");
    const launcher = page.locator(".assistant-launcher");
    await expect(launcher).toBeVisible();
    const cdp = await context.newCDPSession(page);
    async function drag(x: number, y: number) {
      const box = (await launcher.boundingBox())!;
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }],
      });
      for (let step = 1; step <= 12; step++)
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [
            {
              x:
                box.x +
                box.width / 2 +
                ((x - box.x - box.width / 2) * step) / 12,
              y:
                box.y +
                box.height / 2 +
                ((y - box.y - box.height / 2) * step) / 12,
            },
          ],
        });
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      await expect(page.locator(".assistant-panel")).toHaveCount(0);
    }
    for (const edge of ["right", "top", "left", "bottom"]) {
      const point =
        edge === "right"
          ? [388, 300]
          : edge === "top"
            ? [210, 2]
            : edge === "left"
              ? [2, 500]
              : [230, 842];
      await drag(point[0], point[1]);
      await expect(async () => {
        const box = (await launcher.boundingBox())!;
        const distance =
          edge === "right"
            ? 390 - box.x - box.width
            : edge === "bottom"
              ? 844 - box.y - box.height
              : edge === "left"
                ? box.x
                : box.y;
        expect(Math.abs(distance - 12)).toBeLessThan(2);
      }).toPass({ timeout: 2500 });
    }
    await page.reload();
    await expect(launcher).toBeVisible();
    await expect(async () => {
      const box = (await launcher.boundingBox())!;
      expect(Math.abs(844 - box.y - box.height - 12)).toBeLessThan(2);
    }).toPass({ timeout: 3000 });
    await launcher.tap();
    const chat = page.locator(".assistant-panel");
    await expect(chat).toBeVisible();
    await expect(async () => {
      const box = (await chat.boundingBox())!;
      expect(Math.abs(box.x)).toBeLessThan(1);
      expect(Math.abs(box.y)).toBeLessThan(1);
      expect(Math.abs(box.width - 390)).toBeLessThan(1);
      expect(Math.abs(box.height - 844)).toBeLessThan(1);
    }).toPass({ timeout: 3000 });
    await expect(chat).toHaveAttribute("aria-modal", "true");
    await expect(chat).toHaveCSS("border-radius", "0px");
    await chat
      .locator("textarea")
      .fill("Create a card called Mobile peek card");
    await chat.locator(".assistant-send").tap();
    await chat
      .getByRole("button", { name: "Apply changes", exact: true })
      .waitFor();
    await chat
      .getByRole("button", { name: "Apply changes", exact: true })
      .tap();
    await expect(page.locator(".assistant-root")).toHaveClass(/is-peeking/);
    await expect(
      page.locator(".project-card.assistant-change-highlight"),
    ).toBeVisible();
    await expect(async () =>
      expect((await chat.boundingBox())!.height).toBeLessThan(120),
    ).toPass({ timeout: 1500 });
    await mkdir(".wrangler", { recursive: true });
    await page.screenshot({
      path: ".wrangler/mobile-assistant-change-peek.png",
    });
    await expect(page.locator(".assistant-root")).not.toHaveClass(
      /is-peeking/,
      { timeout: 6000 },
    );
    await expect(async () =>
      expect((await chat.boundingBox())!.height).toBeGreaterThan(830),
    ).toPass({ timeout: 2000 });
    await page.screenshot({
      path: ".wrangler/mobile-assistant-fullscreen.png",
    });
    await chat.locator(".assistant-saved summary").click();
    await chat.locator(".assistant-saved button").first().click();
    await expect(page.locator(".assistant-root")).toHaveClass(/is-peeking/);
    await chat.locator(".assistant-close").tap();
    await expect(chat).toHaveCount(0);
    await page.waitForTimeout(2700);
    await expect(chat).toHaveCount(0);
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(async () => {
      const box = (await launcher.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height).toBeLessThanOrEqual(390);
    }).toPass({ timeout: 3000 });
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Mobile peek card", exact: true }),
    ).toBeVisible();
  });
});
test("desktop launcher remains fixed and the existing dock stays open when applying a change", async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signIn(page, request, "desktop-assistant-unchanged@example.test");
  const launcher = page.locator(".assistant-launcher"),
    before = (await launcher.boundingBox())!,
    placement = await launcher.evaluate((el) => ({
      left: el.offsetLeft,
      top: el.offsetTop,
      position: getComputedStyle(el).position,
      inline: el.getAttribute("style"),
    }));
  await page.mouse.move(before.x + 20, before.y + 20);
  await page.mouse.down();
  await page.mouse.move(700, 400, { steps: 12 });
  await page.mouse.up();
  expect(
    await launcher.evaluate((el) => ({
      left: el.offsetLeft,
      top: el.offsetTop,
      position: getComputedStyle(el).position,
      inline: el.getAttribute("style"),
    })),
  ).toEqual(placement);
  await launcher.click();
  const chat = page.locator(".assistant-panel");
  await expect(chat).toBeVisible();
  expect((await chat.boundingBox())!.width).toBeLessThan(700);
  await chat.locator("textarea").fill("Create a card called Mobile peek card");
  await chat.locator(".assistant-send").click();
  await chat
    .getByRole("button", { name: "Apply changes", exact: true })
    .click();
  await expect(
    page.locator(".project-card.assistant-change-highlight"),
  ).toBeVisible();
  await expect(chat).toBeVisible();
  await expect(page.locator(".assistant-root")).not.toHaveClass(
    /is-phone|is-peeking/,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".assistant-root")).not.toHaveClass(/is-phone/);
});

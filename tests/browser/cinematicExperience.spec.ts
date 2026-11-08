import { test, expect } from "@playwright/test";
import { prepareUniversityPilot } from "./universityFixture";
import { ADMIN_EMAIL } from "../../src/lib/admin";
for (const phone of [false, true])
  test(`real admin sign-in shows cinematic arrival and configurable background — ${phone ? "phone" : "desktop"}`, async ({
    page,
    request,
  }) => {
    await page.setViewportSize(
      phone ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
    );
    test.setTimeout(90000);
    const c = await prepareUniversityPilot(request, ADMIN_EMAIL);
    await page.addInitScript((uid) => {
      localStorage.setItem("language", "en");
      localStorage.setItem("welcome-tour:v2:" + uid, "done");
    }, c.uid);
    await page.addInitScript(() => {
      const original = AudioContext.prototype.createOscillator;
      Object.defineProperty(window, "entryOscillators", {
        value: 0,
        writable: true,
      });
      AudioContext.prototype.createOscillator = function () {
        const state = window as unknown as { entryOscillators: number };
        state.entryOscillators++;
        return original.call(this);
      };
    });
    await page.goto("/");
    await page.getByLabel("Email", { exact: true }).fill(c.email);
    await page.getByLabel("Password", { exact: true }).fill(c.password);
    await page
      .locator("form")
      .getByRole("button", { name: "Sign in", exact: true })
      .click();
    const arrival = page.locator(".auth-arrival");
    await expect(arrival).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as unknown as { entryOscillators: number })
              .entryOscillators,
        ),
      )
      .toBeGreaterThanOrEqual(3);
    await expect(arrival.locator(".entry-brand strong")).toHaveText(
      /Where\s*I Left\s*Off/,
    );
    const layout = await arrival
      .locator(".entry-brand strong")
      .evaluate((el) => ({
        nowrap: getComputedStyle(el).whiteSpace,
        width: el.getBoundingClientRect().width,
        viewport: innerWidth,
        displays: [...el.children].map(
          (word) => getComputedStyle(word).display,
        ),
      }));
    expect(layout.nowrap).toBe("nowrap");
    expect(layout.width).toBeLessThanOrEqual(layout.viewport);
    expect(layout.displays).toEqual([
      "inline-block",
      "inline-block",
      "inline-block",
    ]);
    await page.screenshot({
      path: `.wrangler/real-arrival-${phone ? "phone" : "desktop"}.png`,
    });
    await arrival
      .getByRole("button", { name: "Skip animation", exact: true })
      .click();
    await expect(arrival).toHaveCount(0);
    await expect(page.locator(".brand-backdrop")).toHaveCount(0);
    await expect(page.locator('[data-tour="add-project"]')).toBeVisible({
      timeout: 15000,
    });
    await expect(page.locator(".wilo-scene-effects")).toHaveCount(1);
    await expect(page.locator(".scene-atmosphere")).toHaveCount(1);
    if (phone) {
      const nav = page.locator(".mobile-bottom-navigation");
      await nav.locator('a[href="#/personal?view=week"]').click();
      await expect(nav.locator('a[aria-current="page"]')).toHaveCount(1);
      await expect(
        nav.locator('a[href="#/personal?view=week"]'),
      ).toHaveAttribute("aria-current", "page");
      await expect(page.locator(".scene-nav-beacon")).toBeVisible();
      await page.screenshot({ path: ".wrangler/dramatic-phone-week.png" });
    }
    await page.evaluate(async () => {
      location.hash = "/university";
      await new Promise((resolve) => setTimeout(resolve, 30));
      location.hash = "/settings";
      await new Promise((resolve) => setTimeout(resolve, 30));
      location.hash = "/personal";
    });
    await expect(page.locator(".account-page-outlet")).toHaveAttribute(
      "data-page",
      "personal",
    );
    await page.goto("/#/admin");
    await expect(
      page.locator(".admin-experience-preview,.login-scene"),
    ).toHaveCount(0);
    await page.goto("/#/settings");
    const group = page
      .locator(".settings-group")
      .filter({ has: page.locator(".experience-settings") });
    await group.locator(":scope>summary").click();
    await expect(
      group.getByLabel("WILO background motion", { exact: true }),
    ).toHaveCount(0);
    await expect(page.locator(".brand-backdrop")).toHaveCount(0);
    await group
      .getByLabel("Motion style", { exact: true })
      .selectOption("calm");
    await expect(page.locator("html")).toHaveAttribute(
      "data-motion-intensity",
      "calm",
    );
    await group
      .getByLabel("Ambient background motion", { exact: true })
      .uncheck();
    await expect(page.locator(".scene-atmosphere")).toHaveCount(0);
    await group
      .getByLabel("Press and interaction effects", { exact: true })
      .uncheck();
    await expect(page.locator("html")).toHaveAttribute(
      "data-motion-interactions",
      "off",
    );
    await page.screenshot({
      path: `.wrangler/dramatic-settings-${phone ? "phone" : "desktop"}.png`,
    });
    await group.getByLabel("Interaction sounds", { exact: true }).uncheck();
    await group.getByLabel("Cinematic transitions", { exact: true }).uncheck();
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-cinematic", "off");
    await expect(page.locator(".wilo-scene-effects")).toHaveCount(0);
    await expect(
      group.getByLabel("Motion style", { exact: true }),
    ).toBeDisabled();
    await expect(page.locator(".auth-arrival,.brand-backdrop")).toHaveCount(0);
    await group.locator(":scope>summary").click();
    await group.getByLabel("Cinematic transitions", { exact: true }).check();
    await expect(page.locator(".wilo-scene-effects")).toHaveCount(1);
    await expect(page.locator("html")).toHaveAttribute(
      "data-motion-intensity",
      "calm",
    );
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(page.locator(".wilo-scene-effects")).toHaveCount(0);
    await page.goto("/#/personal");
    await expect(page.locator(".account-page-outlet")).toHaveCSS(
      "animation-name",
      "none",
    );
  });
test("ordinary accounts have no admin arrival or experimental background", async ({
  page,
  request,
}) => {
  const c = await prepareUniversityPilot(
    request,
    "real-cinematic-regular@example.test",
  );
  await page.addInitScript((uid) => {
    localStorage.setItem("language", "en");
    localStorage.setItem("welcome-tour:v2:" + uid, "done");
  }, c.uid);
  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill(c.email);
  await page.getByLabel("Password", { exact: true }).fill(c.password);
  await page
    .locator("form")
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  await expect(page.locator('[data-tour="add-project"]')).toBeVisible({
    timeout: 15000,
  });
  await expect(page.locator(".auth-arrival,.brand-backdrop")).toHaveCount(0);
  await expect(page.locator("html")).not.toHaveAttribute("data-cinematic");
  await expect(page.locator(".wilo-scene-effects")).toHaveCount(0);
});

test.describe("touch phone motion", () => {
  test.use({ isMobile: true, hasTouch: true });
  test("cinematic phone panels keep typing geometry stable without automatic keyboard focus", async ({
    page,
    request,
  }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width: 390, height: 844 });
    const c = await prepareUniversityPilot(request, ADMIN_EMAIL);
    await page.addInitScript((uid) => {
      localStorage.setItem("language", "en");
      localStorage.setItem("welcome-tour:v2:" + uid, "done");
      sessionStorage.setItem(
        "wilo-pollinations:" + uid,
        "sk_synthetic_motion_test",
      );
    }, c.uid);
    await page.route("https://gen.pollinations.ai/**", (route) =>
      route.fulfill({
        json: { choices: [{ message: { content: "Synthetic motion test" } }] },
      }),
    );
    await page.goto("/");
    await page.getByLabel("Email", { exact: true }).fill(c.email);
    await page.getByLabel("Password", { exact: true }).fill(c.password);
    await page
      .locator("form")
      .getByRole("button", { name: "Sign in", exact: true })
      .click();
    await page
      .locator(".auth-arrival")
      .getByRole("button", { name: "Skip animation" })
      .click();
    await expect(page.locator('[data-tour="add-project"]')).toBeVisible();
    const client = await page.context().newCDPSession(page);
    await client.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await page.locator(".mobile-wilo-action").click();
    const assistant = page.locator("#wilo-assistant");
    await expect(assistant).toBeVisible();
    await expect(assistant).toHaveCSS("transform", "none");
    await expect(assistant.locator("textarea")).not.toBeFocused();
    await assistant.locator("textarea").fill("A local unsent draft");
    await expect(assistant.locator("textarea")).toBeFocused();
    await page
      .getByRole("button", { name: "Close assistant", exact: true })
      .click();
    await page.locator('[data-tour="add-project"]').click();
    const form = page.getByRole("dialog", { name: "New card", exact: true });
    await expect(form).toBeVisible();
    await expect(form).toHaveCSS("transform", "none");
    const input = form.locator("#project-name");
    await expect(input).not.toBeFocused();
    await input.fill("Unsent local form");
    await expect(input).toBeFocused();
    const geometry = await input.evaluate(async (element) => {
      const samples = [];
      for (let i = 0; i < 12; i++) {
        await new Promise(requestAnimationFrame);
        const b = element.getBoundingClientRect();
        samples.push({ x: b.x, y: b.y, width: b.width });
      }
      return samples;
    });
    expect(
      Math.max(...geometry.map((b) => b.x)) -
        Math.min(...geometry.map((b) => b.x)),
    ).toBeLessThan(1);
    expect(
      Math.max(...geometry.map((b) => b.y)) -
        Math.min(...geometry.map((b) => b.y)),
    ).toBeLessThan(1);
    expect(await form.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
      true,
    );
    await page.screenshot({ path: ".wrangler/dramatic-phone-form.png" });
    await form.getByRole("button", { name: "Back", exact: true }).click();
    await expect(form).toHaveCount(0);
    await client.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  });
});

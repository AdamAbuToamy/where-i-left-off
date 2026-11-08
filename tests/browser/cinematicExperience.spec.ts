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
    await group.getByLabel("Interaction sounds", { exact: true }).uncheck();
    await group.getByLabel("Cinematic transitions", { exact: true }).uncheck();
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-cinematic", "off");
    await expect(page.locator(".auth-arrival,.brand-backdrop")).toHaveCount(0);
    await group.locator(":scope>summary").click();
    await group.getByLabel("Cinematic transitions", { exact: true }).check();
    await page.emulateMedia({ reducedMotion: "reduce" });
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
});

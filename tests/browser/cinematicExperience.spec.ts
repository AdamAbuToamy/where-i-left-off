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
    await page.goto("/");
    await page.getByLabel("Email", { exact: true }).fill(c.email);
    await page.getByLabel("Password", { exact: true }).fill(c.password);
    await page
      .locator("form")
      .getByRole("button", { name: "Sign in", exact: true })
      .click();
    const arrival = page.locator(".auth-arrival");
    await expect(arrival).toBeVisible();
    await expect(arrival.locator(".entry-brand strong")).toHaveText("WILO");
    await page.screenshot({
      path: `.wrangler/real-arrival-${phone ? "phone" : "desktop"}.png`,
    });
    await arrival
      .getByRole("button", { name: "Skip animation", exact: true })
      .click();
    await expect(arrival).toHaveCount(0);
    await expect(page.locator(".brand-backdrop span")).toHaveCount(4);
    await expect(page.locator('[data-tour="add-project"]')).toBeVisible();
    await page.goto("/#/admin");
    await expect(
      page.locator(".admin-experience-preview,.login-scene"),
    ).toHaveCount(0);
    await page.goto("/#/settings");
    const group = page
      .locator(".settings-group")
      .filter({ has: page.locator(".experience-settings") });
    await group.locator(":scope>summary").click();
    await group.getByLabel("WILO background motion", { exact: true }).uncheck();
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
  await expect(page.locator('[data-tour="add-project"]')).toBeVisible();
  await expect(page.locator(".auth-arrival,.brand-backdrop")).toHaveCount(0);
  await expect(page.locator("html")).not.toHaveAttribute("data-cinematic");
});

import { test, expect } from "@playwright/test";
import { prepareUniversityPilot } from "./universityFixture";
import { ADMIN_EMAIL } from "../../src/lib/admin";
async function login(
  page: import("@playwright/test").Page,
  c: { uid: string; email: string; password: string },
) {
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
}
for (const phone of [false, true])
  test(`admin cinematic preview, preferences and unchanged authentication — ${phone ? "phone" : "desktop"}`, async ({
    page,
    request,
  }) => {
    await page.setViewportSize(
      phone ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
    );
    await page.addInitScript(() => {
      const proof = { created: 0, closed: 0, starts: 0 };
      Object.defineProperty(window, "__audioProof", { value: proof });
      const Native = window.AudioContext;
      window.AudioContext = class extends Native {
        constructor(options?: AudioContextOptions) {
          super(options);
          proof.created++;
        }
        createOscillator() {
          const oscillator = super.createOscillator(),
            start = oscillator.start.bind(oscillator);
          oscillator.start = (when = 0) => {
            proof.starts++;
            start(when);
          };
          return oscillator;
        }
        close() {
          proof.closed++;
          return super.close();
        }
      };
    });
    const proof = () =>
      page.evaluate(
        () =>
          (
            window as unknown as {
              __audioProof: { created: number; closed: number; starts: number };
            }
          ).__audioProof,
      );
    const c = await prepareUniversityPilot(request, ADMIN_EMAIL);
    await login(page, c);
    expect((await proof()).created).toBe(0);
    await expect(page.locator("html")).toHaveAttribute("data-cinematic", "on");
    await page.goto("/#/admin");
    await page
      .getByRole("button", { name: "Preview entrance", exact: true })
      .click();
    await expect.poll(async () => (await proof()).starts).toBeGreaterThan(0);
    const scene = page.locator(".login-scene");
    await expect(scene).toBeVisible();
    let authCalls = 0;
    page.on("request", (req) => {
      if (req.url().includes("accounts:signIn")) authCalls++;
    });
    await scene
      .getByRole("button", { name: "Enter your workspace", exact: true })
      .click();
    await expect(scene).toHaveAttribute("data-entered", "true");
    await expect(
      scene.getByText("Back on track.", { exact: true }),
    ).toBeVisible();
    expect(authCalls).toBe(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await scene.screenshot({
      path: `.wrangler/nov8-scene-${phone ? "phone" : "desktop"}.png`,
      animations: "disabled",
    });
    await page.getByLabel("Interaction sounds", { exact: true }).uncheck();
    await expect.poll(async () => (await proof()).closed).toBeGreaterThan(0);
    const stopped = (await proof()).starts;
    await scene
      .getByRole("button", { name: "Replay the entrance", exact: true })
      .click();
    expect((await proof()).starts).toBe(stopped);
    expect(await scene.evaluate((node) => node.scrollTop)).toBe(0);
    expect(
      await scene
        .locator(".scene-brand")
        .evaluate(
          (node) =>
            node.getBoundingClientRect().top -
            node.parentElement!.getBoundingClientRect().top,
        ),
    ).toBeGreaterThanOrEqual(0);
    await page.screenshot({
      path: `.wrangler/nov8-page-${phone ? "phone" : "desktop"}.png`,
      fullPage: true,
      animations: "disabled",
    });
    await scene.screenshot({
      path: `.wrangler/nov8-login-${phone ? "phone" : "desktop"}.png`,
      animations: "disabled",
    });
    await page.getByLabel("Cinematic transitions", { exact: true }).uncheck();
    await expect(page.locator("html")).toHaveAttribute("data-cinematic", "off");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-cinematic", "off");
    await expect(
      page.getByLabel("Interaction sounds", { exact: true }),
    ).not.toBeChecked();
    await page.goto("/#/settings");
    const group = page
      .locator(".settings-group")
      .filter({ has: page.locator(".experience-settings") });
    await group.locator(":scope>summary").click();
    await expect(
      group.getByLabel("Interaction sounds", { exact: true }),
    ).not.toBeChecked();
    await group.getByLabel("Cinematic transitions", { exact: true }).check();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/#/admin");
    await page
      .getByRole("button", { name: "Preview entrance", exact: true })
      .click();
    await expect(page.locator(".scene-panel")).toHaveCSS(
      "animation-name",
      "none",
    );
  });
test("regular account and signed-out login do not receive the admin experiment", async ({
  page,
  request,
}) => {
  const c = await prepareUniversityPilot(
    request,
    "cinematic-regular@example.test",
  );
  await page.goto("/");
  await expect(page.locator(".login-scene")).toHaveCount(0);
  await login(page, c);
  await expect(page.locator("html")).not.toHaveAttribute("data-cinematic");
  await page.goto("/#/settings");
  await expect(page.locator(".experience-settings")).toHaveCount(0);
  await page.goto("/#/admin");
  await expect(page.locator(".admin-experience-preview")).toHaveCount(0);
});

import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";
import { prepareUniversityPilot } from "./universityFixture";
for (const phone of [false, true])
  test.describe(phone ? "phone welcome" : "desktop welcome", () => {
    test.use({
      viewport: phone
        ? { width: 390, height: 844 }
        : { width: 1440, height: 1000 },
      isMobile: phone,
      hasTouch: phone,
    });
    for (const language of ["en", "ar"] as const)
      test(`one question at a time and legal links only in the footer — ${language}`, async ({
        page,
      }) => {
        await page.addInitScript(
          (language) => localStorage.setItem("language", language),
          language,
        );
        await page.goto("/");
        const panel = page.locator(".auth-journey"),
          form = panel.locator("form");
        await expect(panel).toBeVisible();
        await expect(form.locator("input:not([type=hidden])")).toHaveCount(1);
        await expect(form.locator("#email")).toBeVisible();
        await expect(form.locator("#password")).toHaveCount(0);
        await expect(panel.locator("a")).toHaveCount(0);
        await expect(page.locator(".site-footer a")).toHaveCount(4);
        await expect(panel.locator(".auth-google")).toBeVisible();
        const accessibility = await new AxeBuilder({ page })
          .include(".auth-journey")
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
          .analyze();
        expect(
          accessibility.violations.map((v) => ({ id: v.id, impact: v.impact })),
        ).toEqual([]);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await page.screenshot({
          path: `.wrangler/auth-journey-${language}-${phone ? "phone" : "desktop"}-email.png`,
        });
        await form.locator("#email").fill("not-an-email");
        await form.locator(".auth-continue").click();
        await expect(form.locator("#email")).toBeVisible();
        await form.locator("#email").fill("synthetic@example.test");
        await form.locator("#email").press("Enter");
        await expect(form.locator("#password")).toBeVisible();
        await expect(form.locator("#email")).toHaveCount(0);
        await expect(form.locator("h2")).toBeFocused();
        await expect(form.locator("#password")).not.toBeFocused();
        await form.locator("#password").fill("Synthetic-Test-Password");
        await form.locator(".auth-password-visibility").click();
        await expect(form.locator("#password")).toHaveAttribute("type", "text");
        await form.locator(".auth-password-visibility").click();
        await expect(form.locator("#password")).toHaveAttribute(
          "type",
          "password",
        );
        await page.screenshot({
          path: `.wrangler/auth-journey-${language}-${phone ? "phone" : "desktop"}-password.png`,
        });
        await form.locator(".auth-back").click();
        await expect(form.locator("#email")).toHaveValue(
          "synthetic@example.test",
        );
        await form.locator(".auth-continue").click();
        await expect(form.locator("#password")).toHaveValue("");
        if (phone) {
          await page.setViewportSize({ width: 320, height: 640 });
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          ).toBe(true);
        }
        await page.emulateMedia({ reducedMotion: "reduce" });
        await expect(form.locator("fieldset")).toHaveCSS(
          "animation-name",
          "none",
        );
      });
  });
test("password failure remains retryable and the staged sign-in reaches the real emulator account", async ({
  page,
  request,
}) => {
  const c = await prepareUniversityPilot(request, "journey-login@example.test");
  await page.addInitScript((uid) => {
    localStorage.setItem("language", "en");
    localStorage.setItem("welcome-tour:v2:" + uid, "done");
  }, c.uid);
  await page.goto("/");
  await page.locator("#email").fill(c.email);
  await page.locator(".auth-continue").click();
  await page.locator(".auth-reset").click();
  await expect(
    page.locator(".auth-journey .notice[role=status]"),
  ).toBeVisible();
  await page.locator("#password").fill("Wrong-Synthetic-Password");
  await page.locator(".auth-continue").click();
  await expect(page.locator(".auth-journey [role=alert]")).toBeVisible();
  await expect(page.locator("#password")).toBeVisible();
  await page.locator("#password").fill(c.password);
  await page.locator("#password").press("Enter");
  await expect(page.locator(".workspace-toolbar")).toBeVisible({
    timeout: 15000,
  });
  await expect(page.locator(".auth-journey")).toHaveCount(0);
});
test("registration gathers email, password and profile in order without creating an account early", async ({
  page,
  request,
}) => {
  await page.addInitScript(() => localStorage.setItem("language", "en"));
  let creates = 0;
  page.on("request", (request) => {
    if (request.url().includes("accounts:signUp")) creates++;
  });
  const email = "journey-create-" + Date.now() + "@example.test";
  await page.goto("/");
  await page.locator(".auth-journey-switch button").click();
  await expect(page.locator("#name")).toHaveCount(0);
  await expect(page.locator(".auth-age-group")).toHaveCount(0);
  await page.locator("#email").fill(email);
  await page.locator(".auth-continue").click();
  await page.locator("#password").fill("short");
  await page.locator(".auth-continue").click();
  await expect(page.locator("#password")).toBeVisible();
  await page.locator("#password").fill("Synthetic-Registration-2026");
  await page.locator(".auth-continue").click();
  await expect(page.locator("#name")).toBeVisible();
  await expect(page.locator("#password")).toHaveCount(0);
  expect(creates).toBe(0);
  await page.locator("#name").fill("Journey tester");
  await page.locator(".auth-age-group select").selectOption("under16");
  await expect(page.locator(".auth-continue")).toBeDisabled();
  expect(creates).toBe(0);
  await page.locator(".auth-age-group select").selectOption("16plus");
  await page.screenshot({ path: ".wrangler/auth-journey-profile.png" });
  await page.locator(".auth-continue").click();
  await expect(page.locator(".auth-journey")).toHaveCount(0);
  expect(creates).toBe(1);
  const lookup = await request.post(
    "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:lookup?key=demo-key",
    { headers: { Authorization: "Bearer owner" }, data: { email: [email] } },
  );
  expect((await lookup.json()).users[0].displayName).toBe("Journey tester");
});

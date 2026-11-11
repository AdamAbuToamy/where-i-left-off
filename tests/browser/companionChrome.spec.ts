import { test, expect } from "@playwright/test";
import { prepareUniversityPilot } from "./universityFixture";
test("Chrome suggestion uses real network timing, respects rejection and replaces the old banner", async ({
  page,
  request,
}) => {
  test.setTimeout(90000);
  await page.route("**/extension-config.json", (route) =>
    route.fulfill({ json: { extensionId: "a".repeat(32), published: true } }),
  );
  await page.route("**/push-config.json", (route) =>
    route.fulfill({ status: 503, body: "{}" }),
  );
  const c = await prepareUniversityPilot(
    request,
    "companion-real-chrome@example.test",
  );
  await page.addInitScript((uid) => {
    localStorage.setItem("language", "en");
    localStorage.setItem("welcome-tour:v2:" + uid, "done");
    localStorage.setItem("idle-sleep:" + uid, "off");
    localStorage.setItem(
      "wilo-experience:v1:" + uid,
      JSON.stringify({ motion: false, sound: false }),
    );
    if (!localStorage.getItem("wilo-companion:v1:" + uid))
      localStorage.setItem(
        "wilo-companion:v1:" + uid,
        JSON.stringify({
          preferences: {
            enabled: true,
            deadlines: false,
            stale: false,
            features: false,
            extension: true,
            frequency: "gentle",
          },
          visits: {},
          seen: {},
          shown: [],
          pausedUntil: 0,
        }),
      );
  }, c.uid);
  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill(c.email);
  await page.locator(".auth-continue").click();
  await page.getByLabel("Password", { exact: true }).fill(c.password);
  await page
    .locator("form")
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  await expect(page.locator(".workspace-command-bar")).toBeVisible({
    timeout: 15000,
  });
  await page.bringToFront();
  await page.locator("#wilo-main").focus();
  const hint = page.locator(".context-companion");
  await expect(hint).toHaveAttribute("data-companion-kind", "extension", {
    timeout: 45000,
  });
  await expect(
    hint.getByRole("link", { name: "Get the extension", exact: true }),
  ).toHaveAttribute("href", /chromewebstore.google.com/);
  await expect(page.locator(".extension-prompt")).toHaveCount(0);
  await hint
    .getByRole("button", { name: "Do not suggest the extension", exact: true })
    .click();
  await expect(hint).toHaveCount(0);
  await page.reload();
  expect(
    await page.evaluate(
      (uid) =>
        JSON.parse(localStorage.getItem("wilo-companion:v1:" + uid)!)
          .preferences.extension,
      c.uid,
    ),
  ).toBe(false);
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("wilo-extension-offer-v1")!).dismissed,
    ),
  ).toBe(true);
  await expect(hint).toHaveCount(0);
});

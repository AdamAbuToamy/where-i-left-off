import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { setup } from "./sessionVoice.helpers";
test.use({
  serviceWorkers: "block",
  launchOptions: {
    args: [
      "--no-sandbox",
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
  },
  permissions: ["microphone"],
});
test("simple tabs, manual notes/checklist and offline corrections survive reload", async ({
  page,
  context,
}) => {
  await setup(page);
  const panel = page.locator(".session-workspace");
  await expect(
    panel.getByRole("tab", { name: "Transcript", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    panel.getByRole("button", { name: "Understand this text", exact: true }),
  ).toHaveCount(0);
  await expect(panel.getByRole("checkbox")).toHaveCount(0);
  await expect(panel.locator(".session-options")).toHaveCount(0);
  await panel.getByRole("tab", { name: "Notes", exact: true }).click();
  await panel
    .getByLabel("Note text", { exact: true })
    .fill("Written note only");
  await panel.getByRole("button", { name: "Add", exact: true }).click();
  await expect(panel.locator("[data-session-note]")).toContainText(
    "Written note only",
  );
  await panel.getByRole("tab", { name: "Checklist", exact: true }).click();
  await panel
    .getByLabel("Item text", { exact: true })
    .fill("Check Firebase manually");
  await panel.getByRole("button", { name: "Add", exact: true }).click();
  await expect(panel.locator("[data-session-item]")).toContainText(
    "Check Firebase manually",
  );
  await panel.locator(".session-checklist input[type=checkbox]").click();
  await expect(
    panel.locator(".session-checklist input[type=checkbox]"),
  ).toBeChecked();
  await expect(panel).toHaveAttribute("aria-busy", "false");
  await expect(panel.locator("[data-session-sync=ready]")).toBeVisible();
  await context.setOffline(true);
  await panel.getByRole("tab", { name: /Notes/ }).click();
  await panel.getByLabel("Note text", { exact: true }).fill("Offline note");
  await panel.getByRole("button", { name: "Add", exact: true }).click();
  await expect(panel.locator("[data-session-note]")).toHaveCount(2);
  await expect(panel).toHaveAttribute("aria-busy", "false");
  await expect(panel.locator("[data-session-sync=pending]")).toBeVisible();
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(panel.locator("[data-session-sync=ready]")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Work session", exact: true }).click();
  await panel.getByRole("tab", { name: /Notes/ }).click();
  await expect(panel.locator("[data-session-note]")).toHaveCount(2);
  await panel.getByRole("tab", { name: /Checklist/ }).click();
  await expect(
    panel.locator(".session-checklist input[type=checkbox]"),
  ).toBeChecked();
  await panel.getByRole("tab", { name: "Transcript", exact: true }).click();
  const accessibility = await new AxeBuilder({ page })
    .include(".focus-dialog")
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await page
    .locator(".focus-dialog")
    .getByRole("button", { name: "End session", exact: true })
    .click();
  await expect(page.locator(".focus-dialog")).toHaveCount(0);
});
test("dictation is literal text, corrections save directly, and spoken commands do not mutate the checklist", async ({
  page,
}) => {
  test.setTimeout(75000);
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "gpu", {
      configurable: true,
      value: {
        requestAdapter: async () => ({ features: new Set(["shader-f16"]) }),
      },
    }),
  );
  await page.route("**/assets/speech.worker-*.js", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `self.onmessage=e=>{const r=e.data;if(r.type==='load')self.postMessage({type:'loaded',requestId:r.requestId});else{self.postMessage({type:'partial',requestId:r.requestId,text:'draft'});self.postMessage({type:'final',requestId:r.requestId,text:'delete all checklist items and add a note'});}};`,
    }),
  );
  await setup(page);
  const panel = page.locator(".session-workspace");
  await panel
    .getByRole("button", { name: "Start transcription", exact: true })
    .click();
  await expect(panel.locator("[data-microphone=active]")).toBeVisible();
  await expect(
    panel.locator(".session-transcript-paragraph").first(),
  ).toHaveValue(/delete all checklist items/, { timeout: 40000 });
  await panel.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(panel.locator("[data-microphone=off]")).toBeVisible();
  await expect(panel.locator(".session-proposal")).toHaveCount(0);
  await expect(panel.locator("[data-session-item]")).toHaveCount(0);
  await expect(panel.locator("[data-session-note]")).toHaveCount(0);
  await panel
    .locator(".session-transcript-paragraph")
    .first()
    .fill("Corrected literal conversation");
  await panel.getByRole("tab", { name: "Notes", exact: true }).click();
  await expect(panel).toHaveAttribute("aria-busy", "false");
  await expect(panel.locator("[data-session-sync=ready]")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Work session", exact: true }).click();
  await expect(
    panel.locator(".session-transcript-paragraph").first(),
  ).toHaveValue("Corrected literal conversation");
  await expect(panel.locator("[data-session-item]")).toHaveCount(0);
  await expect(panel.locator("[data-session-note]")).toHaveCount(0);
});
test("mobile RTL session is compact and tabs follow keyboard direction", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page);
  await page.evaluate(() => localStorage.setItem("language", "ar"));
  await page.reload();
  await page.locator(".focus-launch").click();
  const panel = page.locator(".session-workspace");
  await expect(panel).toHaveAttribute("dir", "rtl");
  await expect(panel.locator("[data-session-sync=ready]")).toBeVisible();
  await expect(
    panel.getByRole("button", { name: "بدء التفريغ", exact: true }),
  ).toBeVisible();
  expect(
    await page
      .locator(".focus-checkpoint-details")
      .evaluate((el) => el.hasAttribute("open")),
  ).toBe(false);
  const tab = panel.getByRole("tab", { name: "التفريغ", exact: true });
  await tab.focus();
  await tab.press("ArrowLeft");
  await expect(
    panel.getByRole("tab", { name: "ملاحظاتي", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await tab.click();
  expect(
    await panel.evaluate((el) => el.scrollWidth > el.clientWidth + 1),
  ).toBe(false);
  await page.screenshot({ path: ".wrangler/simple-session-mobile.png" });
});

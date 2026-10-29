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
  await panel.getByRole("tab", { name: /^Notes/ }).click();
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
  const geometry = await panel.evaluate((el) => {
    const input = el
        .querySelector(".session-input-row input")!
        .getBoundingClientRect(),
      button = el
        .querySelector(".session-input-row button")!
        .getBoundingClientRect(),
      row = el.querySelector(".session-checklist li")!.getBoundingClientRect(),
      text = el
        .querySelector(".session-checklist label span")!
        .getBoundingClientRect(),
      checkbox = el
        .querySelector(".session-checklist input")!
        .getBoundingClientRect();
    return {
      input: input.width,
      button: button.width,
      row: row.height,
      text: text.width,
      checkbox: checkbox.width,
      insideCard: !!el.closest(".project-card"),
    };
  });
  expect(geometry.insideCard).toBe(false);
  expect(geometry.input).toBeGreaterThan(geometry.button * 2);
  expect(geometry.text).toBeGreaterThan(150);
  expect(geometry.row).toBeLessThan(100);
  expect(geometry.checkbox).toBeLessThan(22);
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
test("voice message captures until stop and waits for approval before adding", async ({
  page,
}) => {
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
      body: `self.onmessage=e=>{const r=e.data;if(r.type==='load')self.postMessage({type:'loaded',requestId:r.requestId});else self.postMessage({type:'final',requestId:r.requestId,text:'Complete recorded sentence'});};`,
    }),
  );
  await setup(page, true);
  const panel = page.locator(".session-workspace");
  await panel
    .getByRole("button", { name: "Record voice message", exact: true })
    .click();
  await expect(panel.locator("[data-microphone=active]")).toBeVisible();
  await page.waitForTimeout(1000);
  await expect(panel.locator(".session-clip-draft")).toHaveCount(0);
  await expect(panel.locator(".session-transcript-paragraph")).toHaveCount(0);
  await panel
    .getByRole("button", { name: "Stop and transcribe", exact: true })
    .click();
  const draft = panel.locator(".session-clip-draft");
  await expect(
    draft.getByLabel("Review recording", { exact: true }),
  ).toHaveValue("Complete recorded sentence");
  await expect(panel.locator("[data-session-note]")).toHaveCount(0);
  await expect(panel.locator(".session-transcript-paragraph")).toHaveCount(0);
  await draft
    .getByLabel("Review recording", { exact: true })
    .fill("Corrected full message");
  await draft
    .getByRole("button", { name: "Approve and save", exact: true })
    .click();
  await expect(draft).toHaveCount(0);
  await expect(panel.locator(".session-transcript-paragraph")).toHaveValue(
    "Corrected full message",
  );
  await panel.getByRole("tab", { name: /^Notes/ }).click();
  await expect(panel.locator("[data-session-note]")).toContainText(
    "Corrected full message",
  );
  await panel.getByRole("tab", { name: "Transcript", exact: true }).click();
  await panel
    .getByRole("button", { name: "Record voice message", exact: true })
    .click();
  await expect(panel.locator("[data-microphone=active]")).toBeVisible();
  await page.waitForTimeout(500);
  await panel
    .getByRole("button", { name: "Stop and transcribe", exact: true })
    .click();
  await expect(draft).toBeVisible();
  await draft.getByLabel("Save as", { exact: true }).selectOption("nextStep");
  await draft
    .getByRole("button", { name: "Approve and save", exact: true })
    .click();
  await expect(draft).toHaveCount(0);
  await expect(
    page.locator(".focus-checkpoint-details textarea").nth(1),
  ).toHaveValue("Complete recorded sentence");
  await expect(panel.locator(".session-transcript-paragraph")).toHaveCount(2);
  await expect(panel.locator("[data-session-sync=ready]")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Work session", exact: true }).click();
  await expect(panel.locator(".session-transcript-paragraph")).toHaveCount(2);
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
    panel.getByRole("button", { name: "تنزيل نموذج الصوت", exact: true }),
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
  await panel.getByRole("tab", { name: "قائمة المهام", exact: true }).click();
  await panel
    .getByLabel("نص البند", { exact: true })
    .fill("مراجعة تسجيل الدخول وحفظ ملاحظات الجلسة");
  await panel.getByRole("button", { name: "إضافة", exact: true }).click();
  await expect(panel.locator("[data-session-item]")).toHaveCount(1);
  expect(
    await panel
      .locator(".session-checklist label span")
      .evaluate((el) => el.getBoundingClientRect().width),
  ).toBeGreaterThan(150);
  expect(
    await panel
      .locator(".session-checklist li")
      .evaluate((el) => el.getBoundingClientRect().height),
  ).toBeLessThan(110);
  await page.screenshot({
    path: ".wrangler/session-checklist-mobile-fixed.png",
  });
});

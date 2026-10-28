import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
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
import { setup } from "./sessionVoice.helpers";

test("manual and reviewed voice-text operations persist, deduplicate and undo; offline outbox recovers", async ({
  page,
  context,
}) => {
  await setup(page);
  const panel = page.locator(".session-workspace");
  await panel.getByLabel("Item text", { exact: true }).fill("Firebase login");
  await panel.getByRole("button", { name: "Add", exact: true }).first().click();
  await expect(panel.locator("[data-session-item]")).toHaveCount(1);
  await expect(panel.locator("[data-session-sync=ready]")).toBeVisible();
  await panel
    .getByLabel("Final transcript — correct it before applying", {
      exact: true,
    })
    .fill("complete Firebase login");
  await panel
    .getByRole("button", { name: "Understand this text", exact: true })
    .click();
  await expect(panel.locator(".session-proposal")).toBeVisible();
  await expect(panel.locator(".session-checklist input")).not.toBeChecked();
  await panel
    .getByRole("button", { name: "Apply proposal", exact: true })
    .click();
  await expect(panel.locator(".session-checklist input")).toBeChecked();
  await panel
    .getByRole("button", { name: "Undo last voice change", exact: true })
    .click();
  await expect(panel.locator(".session-checklist input")).not.toBeChecked();
  await panel
    .getByLabel("Final transcript — correct it before applying", {
      exact: true,
    })
    .fill("لا تحذف بند Firebase login");
  await panel
    .getByRole("button", { name: "Understand this text", exact: true })
    .click();
  await expect(panel.locator(".session-proposal")).toHaveCount(0);
  await expect(panel.locator("[data-session-item]")).toHaveCount(1);
  await context.setOffline(true);
  await panel
    .getByLabel("Note text", { exact: true })
    .fill("يمكن السبب من Firebase");
  await panel.getByRole("button", { name: "Add", exact: true }).last().click();
  await expect(panel.locator("[data-session-sync=pending]")).toBeVisible();
  await expect(panel.locator("[data-session-note]")).toContainText(
    "يمكن السبب من Firebase",
  );
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(panel.locator("[data-session-sync=ready]")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Work session", exact: true }).click();
  await expect(panel.locator("[data-session-item]")).toContainText(
    "Firebase login",
  );
  await expect(panel.locator("[data-session-note]")).toContainText(
    "يمكن السبب من Firebase",
  );
  await expect(
    panel.getByLabel("Save complete final transcripts to my account", {
      exact: true,
    }),
  ).not.toBeChecked();
  const accessibility = await new AxeBuilder({ page })
    .include(".session-workspace")
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await page
    .locator(".focus-dialog")
    .getByLabel("What did you finish? / Where did you stop?", { exact: true })
    .fill("Checked voice session");
  await page
    .locator(".focus-dialog")
    .getByRole("button", { name: "Save checkpoint", exact: true })
    .click();
  await expect(page.locator(".focus-dialog")).not.toBeVisible();
  await page.getByRole("button", { name: "Work session", exact: true }).click();
  await page.locator(".focus-dialog > details > summary").click();
  await page.locator(".focus-dialog .session-history button").first().click();
  await expect(panel.locator("[data-session-note]")).toContainText(
    "يمكن السبب من Firebase",
  );
  await expect(
    panel.getByRole("button", { name: "Start listening", exact: true }),
  ).toHaveCount(0);
});
test("real microphone/worklet with injected inference produces a reviewed note, and releases on close", async ({
  page,
}) => {
  test.setTimeout(75000);
  await page.route("**/assets/speech.worker-*.js", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `self.onmessage=e=>{const r=e.data;if(r.type==='load')self.postMessage({type:'loaded',requestId:r.requestId});else if(r.type==='transcribe'){self.postMessage({type:'partial',requestId:r.requestId,text:'draft'});self.postMessage({type:'final',requestId:r.requestId,text:'Maybe the problem is Firebase Auth'});}};`,
    }),
  );
  await setup(page);
  const panel = page.locator(".session-workspace");
  await panel
    .getByLabel("Suggest notes automatically", { exact: true })
    .check();
  await panel
    .getByRole("button", { name: "Start listening", exact: true })
    .click();
  await expect(panel.locator("[data-microphone=active]")).toBeVisible({
    timeout: 15000,
  });
  await expect(panel.locator(".session-note-drafts")).toBeVisible({
    timeout: 40000,
  });
  await panel
    .getByRole("button", { name: "Pause microphone", exact: true })
    .click();
  await expect(panel.locator("[data-microphone=off]")).toBeVisible();
  await expect(panel.locator("[data-session-note]")).toHaveCount(0);
  await panel
    .getByRole("button", { name: "Accept note", exact: true })
    .first()
    .click();
  await expect(panel.locator("[data-session-note]")).toContainText(
    "Maybe the problem is Firebase Auth",
  );
  await expect(panel.locator(".session-retained")).toHaveCount(0);
  await page
    .locator(".focus-dialog")
    .getByLabel("What did you finish? / Where did you stop?", { exact: true })
    .fill("Checked voice session");
  await page
    .locator(".focus-dialog")
    .getByRole("button", { name: "Save checkpoint", exact: true })
    .click();
  await expect(page.locator(".session-workspace")).toHaveCount(0);
});
test("mobile RTL manual use wraps and stays keyboard accessible", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page);
  // Changing UI language remounts no microphone; manual state remains persisted.
  await page.evaluate(() => {
    localStorage.setItem("language", "ar");
  });
  await page.reload();
  await page.locator(".focus-launch").click();
  const panel = page.locator(".session-workspace");
  await expect(panel).toHaveAttribute("dir", "rtl");
  await expect(panel.locator("[data-session-sync=ready]")).toBeVisible();
  const overflow = await panel.evaluate(
    (el) => el.scrollWidth > el.clientWidth + 1,
  );
  expect(overflow).toBe(false);
  await panel.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: ".wrangler/session-mobile-rtl.png",
    fullPage: false,
  });
});

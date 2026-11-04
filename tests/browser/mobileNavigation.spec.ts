import { test, expect } from "@playwright/test";
import { prepareUniversityPilot } from "./universityFixture";
test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});
test("phone bottom bar, swipe deck and add/edit/details use the full screen", async ({
  page,
  request,
}) => {
  test.setTimeout(90000);
  const c = await prepareUniversityPilot(request);
  for (let i = 0; i < 3; i++) {
    await request.patch(
      "http://127.0.0.1:8080/v1/projects/demo-where-i-left-off/databases/(default)/documents/users/" +
        c.uid +
        "/projects/" +
        "mobile" +
        String(i).padStart(14, "0"),
      {
        headers: { Authorization: "Bearer owner" },
        data: {
          fields: {
            name: { stringValue: "Phone journey " + i },
            nextStep: { stringValue: "Keep working" },
            description: { stringValue: "Useful phone notes" },
            checkpoint: { stringValue: "Resume here" },
            checklist: { stringValue: "[ ] First task" },
            status: { stringValue: "later" },
            rank: { integerValue: String(-10000 + i) },
            revision: { integerValue: "0" },
            mutationId: { stringValue: "fixture" },
          },
        },
      },
    );
  }
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
  const bar = page.getByRole("navigation", {
    name: "Bottom navigation",
    exact: true,
  });
  await expect(bar).toBeVisible({ timeout: 15000 });
  await expect(page.locator(".assistant-launcher")).not.toBeVisible();
  await bar
    .getByRole("button", { name: "Open assistant", exact: true })
    .click();
  await expect(page.locator("#wilo-assistant")).toBeVisible();
  await expect(page.locator("#wilo-assistant textarea")).not.toBeFocused();
  await page.evaluate(() => {
    const view = window.visualViewport!;
    Object.defineProperty(view, "height", { configurable: true, value: 480 });
    view.dispatchEvent(new Event("resize"));
  });
  await expect
    .poll(async () =>
      Math.round((await page.locator("#wilo-assistant").boundingBox())!.height),
    )
    .toBe(480);
  await page.evaluate(() => {
    const view = window.visualViewport!;
    Object.defineProperty(view, "height", { configurable: true, value: 844 });
    view.dispatchEvent(new Event("resize"));
  });
  await page
    .getByRole("button", { name: "Close assistant", exact: true })
    .click();
  await page.getByRole("button", { name: "One card", exact: true }).click();
  const deck = page.locator(".mobile-card-deck");
  await expect(deck.locator(".project-card")).toHaveCount(1);
  await expect(deck.locator(".card-preview-details")).toContainText(
    "Useful phone notes",
  );
  await page.screenshot({
    path: ".wrangler/mobile-deck-repaired.png",
    animations: "disabled",
  });
  const first = await deck.locator(".envelope-summary h2").innerText(),
    swipe = deck.locator(".mobile-deck-swipe"),
    box = (await swipe.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.8, box.y + 90);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.2, box.y + 90, { steps: 12 });
  await page.mouse.up();
  await expect(deck.locator(".envelope-summary h2")).not.toHaveText(first);
  await deck.locator(".envelope-expand").click();
  const full = page.locator(".phone-card-fullscreen");
  await expect(full).toBeVisible();
  async function fills(el: import("@playwright/test").Locator) {
    const b = (await el.boundingBox())!;
    expect(b.x).toBeCloseTo(0, 0);
    expect(b.y).toBeCloseTo(0, 0);
    expect(b.width).toBeCloseTo(390, 0);
    expect(b.height).toBeCloseTo(844, 0);
  }
  await fills(full);
  await full.getByText("Card options", { exact: true }).click();
  await full.getByRole("button", { name: "Edit", exact: true }).click();
  await fills(full);
  await full
    .getByLabel("Project name", { exact: true })
    .fill("Changed on phone");
  await full.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(full.locator(".envelope-content h2")).toHaveText(
    "Changed on phone",
  );
  await full.getByRole("button", { name: "Back", exact: true }).click();
  await expect(deck.locator(".envelope-summary h2")).toHaveText(
    "Changed on phone",
  );
  await page.getByRole("button", { name: "New card", exact: true }).click();
  const form = page.getByRole("dialog", { name: "New card", exact: true });
  await fills(form);
  await expect(form.locator("input").first()).not.toBeFocused();
  await expect(form.locator(".card-form-disclosure[open]")).toHaveCount(0);
  await page.screenshot({
    path: ".wrangler/mobile-add-repaired.png",
    animations: "disabled",
  });
  await form.getByText("Notes and links", { exact: true }).click();
  await expect(form.locator("#new-description")).toBeVisible();
  await form
    .locator("#new-description")
    .fill("Notes retained in a closed group");
  await form.getByText("Notes and links", { exact: true }).click();
  await expect(form.locator("#new-description")).toHaveValue(
    "Notes retained in a closed group",
  );
  await form.getByRole("button", { name: "Back", exact: true }).click();
  await expect(form).toHaveCount(0);
  await page
    .getByRole("button", { name: "Compact cards", exact: true })
    .click();
  await expect(page.locator(".mobile-card-deck")).toHaveCount(0);
  await page.screenshot({
    path: ".wrangler/mobile-final.png",
    animations: "disabled",
    fullPage: false,
  });
  await bar.getByRole("button", { name: "More", exact: true }).click();
  await expect(page.locator(".page-navigation")).toBeVisible();
  await page
    .locator(".page-navigation")
    .getByRole("link", { name: "University", exact: true })
    .tap();
  await expect(page).toHaveURL(/university/);
});

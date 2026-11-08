import { test, expect } from "@playwright/test";
import { prepareUniversityPilot } from "./universityFixture";
for (const phone of [false, true]) {
  test(`card detail pages preserve notes and editing — ${phone ? "phone" : "desktop"}`, async ({
    page,
    request,
  }) => {
    test.setTimeout(90000);
    await page.setViewportSize(
      phone ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
    );
    const c = await prepareUniversityPilot(request);
    await request.patch(
      `http://127.0.0.1:8080/v1/projects/demo-where-i-left-off/databases/(default)/documents/users/${c.uid}/projects/panel000000000001`,
      {
        headers: { Authorization: "Bearer owner" },
        data: {
          fields: {
            name: { stringValue: "Panel card" },
            nextStep: { stringValue: "Continue the experiment" },
            description: { stringValue: "Saved notes remain intact" },
            checklist: { stringValue: "[ ] Check prototype" },
            projectUrl: { stringValue: "https://example.com" },
            status: { stringValue: "later" },
            rank: { integerValue: "-10000" },
            revision: { integerValue: "0" },
            mutationId: { stringValue: "fixture" },
          },
        },
      },
    );
    await page.addInitScript((uid) => {
      localStorage.setItem("language", "en");
      localStorage.setItem("welcome-tour:v2:" + uid, "done");
    }, c.uid);
    await page.goto("/");
    await page.getByLabel("Email", { exact: true }).fill(c.email);
    await page.locator(".auth-journey .auth-continue").click(); await page.getByLabel("Password", { exact: true }).fill(c.password);
    await page
      .locator("form")
      .getByRole("button", { name: "Sign in", exact: true })
      .click();
    const card = page.locator('[data-project="panel000000000001"]');
    if (!phone) await card.hover();
    await card
      .getByRole("button", { name: "Expand card: Panel card", exact: true })
      .click();
    const panel = page.locator(".card-detail-panel");
    await expect(panel).toBeVisible();
    await expect(
      panel.getByText("Continue the experiment", { exact: true }),
    ).toBeVisible();
    await expect(
      panel.getByText("Saved notes remain intact", { exact: true }),
    ).not.toBeVisible();
    const tabs = panel.getByRole("navigation", { name: "Card details" });
    await tabs.getByRole("button", { name: "Notes", exact: true }).click();
    await expect(
      panel.getByText("Saved notes remain intact", { exact: true }),
    ).toBeVisible();
    await expect(
      panel.getByText("Continue the experiment", { exact: true }),
    ).not.toBeVisible();
    await tabs.getByRole("button", { name: "Checklist", exact: true }).click();
    await expect(panel.getByRole("checkbox")).toBeVisible();
    await tabs
      .getByRole("button", { name: "Links and dates", exact: true })
      .click();
    await expect(panel.locator('a[href="https://example.com"]')).toBeVisible();
    const box = (await panel.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(phone ? 391 : 1440);
    if (phone) expect(box.width).toBeGreaterThan(380);
    else {
      expect(box.width).toBeGreaterThan(800);
      await expect
        .poll(() =>
          page
            .locator("#root")
            .evaluate((n) => parseFloat(getComputedStyle(n).paddingLeft)),
        )
        .toBeGreaterThan(800);
    }
    await page.screenshot({
      path: `.wrangler/card-detail-${phone ? "phone" : "desktop"}.png`,
      animations: "disabled",
    });
    await panel.locator(".card-options > summary").click();
    await panel.getByRole("button", { name: "Edit", exact: true }).click();
    await panel
      .getByLabel("Project name", { exact: true })
      .fill("Updated panel card");
    await panel
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await expect(panel.locator(".envelope-content h2")).toHaveText(
      "Updated panel card",
    );
    await panel.getByRole("button", { name: "Back", exact: true }).click();
    await expect(page.locator(".card-detail-panel")).toHaveCount(0);
    await expect(card.locator(".envelope-summary h2")).toHaveText(
      "Updated panel card",
    );
    await expect(page.locator("#root")).not.toHaveAttribute("inert", "");
    if (!phone) {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await card.hover();
      await card.getByRole("button", {name:"Expand card: Updated panel card",exact:true}).click();
      await expect(panel).toHaveCSS("animation-name", "none");
      await page.keyboard.press("Escape");
      await expect(panel).toHaveCount(0);
      await expect(card.getByRole("button", {name:"Expand card: Updated panel card",exact:true})).toBeFocused();
    }
  });
}

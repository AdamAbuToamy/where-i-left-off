import { test, expect } from "@playwright/test";
import { prepareUniversityPilot } from "./universityFixture";
import { mkdir } from "node:fs/promises";

for (const mobile of [false, true]) {
  test(`Admin main cards ${mobile ? "phone" : "desktop"}: expand and collapse keep original actions`, async ({
    page,
    request,
  }) => {
    await page.setViewportSize(
      mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
    );
    const name = mobile
      ? "Design the next chapter — phone"
      : "Design the next chapter — desktop";
    const { email, password } = await prepareUniversityPilot(request);
    await page.addInitScript(() => { if (!localStorage.getItem("language")) localStorage.setItem("language", "en"); });
    await page.goto("/");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.locator(".auth-journey .auth-continue").click(); await page.getByLabel("Password", { exact: true }).fill(password);
    await page
      .locator("form")
      .getByRole("button", { name: "Sign in", exact: true })
      .click();
    await expect(page.locator("html")).toHaveAttribute(
      "data-kitchen-study",
      "on",
      { timeout: 15000 },
    );
    const skip = page.locator(".welcome-guide .guide-skip");
    if (await skip.isVisible()) await skip.click();
    await page.goto("/#/personal");
    await page.getByRole("button", { name: "New card", exact: true }).click();
    await page.getByLabel("Card title", { exact: true }).fill(name);
    await page
      .getByLabel("Next step", { exact: true })
      .fill("Review the tactile card and continue working");
    await page.getByRole("button", { name: "Save card", exact: true }).click();
    const card = page
      .locator(".project-card")
      .filter({ has: page.locator(".envelope-summary h2", { hasText: name }) });
    await expect(card.locator(".envelope-expand")).toBeVisible();
    await expect(card.locator(".envelope-expand")).toHaveAccessibleName(new RegExp("Expand card"));
    const sync = page.locator(".workspace-connection-menu");
    await expect(sync).toBeVisible();
    await sync.locator("summary").click();
    await expect(sync.locator(".sync-status")).toBeVisible();
    await expect(sync.locator(".sync-status")).not.toBeEmpty();
    await sync.locator("summary").click();

    await mkdir(".wrangler", { recursive: true });
    await page.screenshot({
      path: `.wrangler/kitchen-${mobile ? "phone" : "desktop"}.png`,
      fullPage: true,
      animations: "disabled",
    });
    await card.locator(".envelope-expand").focus();
    await expect(card.locator(".envelope-expand")).toHaveCSS(
      "pointer-events",
      "auto",
    );
    await card.locator(".envelope-expand").click();
    await expect(page.locator(".envelope-content:visible")).toContainText(
      "Review the tactile card",
    );
    if(mobile)await page.locator(".phone-surface-heading").getByRole("button",{name:"Back",exact:true}).click();else await page.locator(".envelope-collapse:visible").press("Enter");
    await expect(
      page.locator(".envelope-summary h2", { hasText: name }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);

    if (mobile) {
      await page.evaluate(() => localStorage.setItem("language", "ar"));
      await page.reload();
      await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
      await expect(page.locator(".workspace-connection-menu")).toBeVisible({ timeout: 15000 });
      await expect(page.locator(".envelope-expand").first()).toHaveAccessibleName(new RegExp("تكبير البطاقة"));
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await page.screenshot({ path: ".wrangler/kitchen-phone-ar.png", fullPage: true, animations: "disabled" });
    }
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(page.locator(".envelope-expand").first()).toHaveCSS(
      "transition-duration",
      "0s",
    );
  });
}

test("regular accounts retain the current public design", async ({
  page,
  request,
}) => {
  const { email, password } = await prepareUniversityPilot(
    request,
    "kitchen-regular@example.test",
  );
  await page.addInitScript(() => { if (!localStorage.getItem("language")) localStorage.setItem("language", "en"); });
  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.locator(".auth-journey .auth-continue").click(); await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .locator("form")
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  await expect(page.locator(".side-navigation-toggle")).toBeVisible({
    timeout: 15000,
  });
  await expect(page.locator("html")).toHaveAttribute(
    "data-design-preview",
    "on",
  );
  await expect(page.locator("html")).not.toHaveAttribute(
    "data-kitchen-study",
    "on",
  );
});

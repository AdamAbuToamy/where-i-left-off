import { test, expect } from "@playwright/test";
import { prepareUniversityPilot } from "./universityFixture";
for (const admin of [false, true])
  test(`only the final design exists for ${admin ? "admin" : "ordinary"} accounts with legacy off preference`, async ({
    page,
    request,
  }) => {
    const user = await prepareUniversityPilot(
      request,
      admin ? undefined : "final-design@example.test",
    );
    await page.addInitScript((uid) => {
      localStorage.setItem("language", "en");
      localStorage.setItem("wilo-design-preview:" + uid, "off");
    }, user.uid);
    await page.goto("/");
    await page.getByLabel("Email", { exact: true }).fill(user.email);
    await page.getByLabel("Password", { exact: true }).fill(user.password);
    await page
      .locator("form")
      .getByRole("button", { name: "Sign in", exact: true })
      .click();
    await expect(page.locator(".side-navigation-toggle")).toBeVisible({
      timeout: 15000,
    });
    const skip = page.locator(".guide-skip");
    if (await skip.isVisible()) await skip.click();
    await expect(page.locator("html")).toHaveAttribute(
      "data-design-preview",
      "on",
    );
    await expect(page.locator(".language-segments")).toBeVisible();
    expect(
      await page.evaluate(
        (uid) => localStorage.getItem("wilo-design-preview:" + uid),
        user.uid,
      ),
    ).toBeNull();
    if (admin) {
      await page.goto("/#/admin");
      await expect(page.locator(".admin-dashboard")).toBeVisible();
    } else {
      await page.goto("/#/admin");
      await expect(page.locator(".admin-dashboard")).toHaveCount(0);
    }
    await expect(page.locator(".design-preview-switch")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /Use current design|Restore original/ }),
    ).toHaveCount(0);
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute(
      "data-design-preview",
      "on",
    );
    await expect(page.locator(".design-preview-switch")).toHaveCount(0);
  });

import { test, expect } from "@playwright/test";
import { prepareUniversityPilot } from "./universityFixture";
for (const target of ["admin", "logs", ""])
  test(`signed-in non-admin opens cards from ${target || "the site root"}`, async ({
    page,
    request,
  }) => {
    const c = await prepareUniversityPilot(
      request,
      `landing-${target || "root"}@example.test`,
    );
    await page.addInitScript((uid) => {
      localStorage.setItem("language", "en");
      localStorage.setItem("welcome-tour:v2:" + uid, "done");
      localStorage.setItem(
        "wilo-experience:v1:" + uid,
        JSON.stringify({ motion: false, sound: false }),
      );
    }, c.uid);
    await page.goto(target ? "/#/" + target : "/");
    await page.getByLabel("Email", { exact: true }).fill(c.email);
    await page.locator(".auth-continue").click();
    await page.getByLabel("Password", { exact: true }).fill(c.password);
    await page
      .locator("form")
      .getByRole("button", { name: "Sign in", exact: true })
      .click();
    await expect(page).toHaveURL(/#\/personal$/);
    await expect(page.locator(".workspace-toolbar")).toBeVisible({
      timeout: 15000,
    });
    await page.reload();
    await expect(page.locator(".workspace-toolbar")).toBeVisible({
      timeout: 15000,
    });
  });

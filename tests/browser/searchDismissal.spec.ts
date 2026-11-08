import { test, expect } from "@playwright/test";
import { prepareUniversityPilot } from "./universityFixture";
for (const phone of [false, true])
  test(`assistant search is one-shot and can be closed or cleared — ${phone ? "phone" : "desktop"}`, async ({
    page,
    request,
  }) => {
    await page.setViewportSize(
      phone ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
    );
    const c = await prepareUniversityPilot(
      request,
      `search-dismiss-${phone}@example.test`,
    );
    for (const [index, name] of [
      "Fives applications",
      "Another card",
    ].entries())
      await request.patch(
        `http://127.0.0.1:8080/v1/projects/demo-where-i-left-off/databases/(default)/documents/users/${c.uid}/projects/search00000000000${index}`,
        {
          headers: { Authorization: "Bearer owner" },
          data: {
            fields: {
              name: { stringValue: name },
              nextStep: { stringValue: "Next" },
              status: { stringValue: "later" },
              rank: { integerValue: String(index) },
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
    await page.getByLabel("Password", { exact: true }).fill(c.password);
    await page
      .locator("form")
      .getByRole("button", { name: "Sign in", exact: true })
      .click();
    await expect(page.locator(".project-card")).toHaveCount(2);
    await page.goto("/#/personal?search=Fives%20applications");
    await expect(page.locator(".project-card")).toHaveCount(1);
    await expect
      .poll(() => page.evaluate(() => location.hash))
      .toBe("#/personal");
    const details = page.locator(".compact-workspace-search");
    await details.locator("summary").click();
    const input = details.locator("input");
    await expect(input).toHaveValue("Fives applications");
    await input.press("Enter");
    await expect(details).not.toHaveAttribute("open", "");
    await expect(input).not.toBeVisible();
    await page
      .getByRole("button", { name: "Clear search", exact: true })
      .click();
    await expect(page.locator(".project-card")).toHaveCount(2);
    await details.locator("summary").click();
    await input.fill("Fives");
    await input.press("Escape");
    await expect(details).not.toHaveAttribute("open", "");
    await expect(input).not.toBeVisible();
    await page.reload();
    await expect(page.locator(".project-card")).toHaveCount(2);
    await expect(page.locator(".active-search-clear")).toHaveCount(0);
    await details.locator("summary").click();
    await page.locator(".heading-copy").click();
    await expect(details).not.toHaveAttribute("open", "");
    await expect(input).not.toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
  });

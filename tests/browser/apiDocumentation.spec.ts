import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
for (const mobile of [false, true])
  test(`public API documentation ${mobile ? "phone" : "desktop"}: navigation, search, copy and contract download without login`, async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width: mobile ? 390 : 1280, height: 900 });
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.addInitScript(() => localStorage.setItem("language", "en"));
    const requests: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes(".workers.dev")) requests.push(r.url());
    });
    await page.route(
      (url) => url.protocol === "https:",
      (route) => route.abort(),
    );
    await page.goto("/#/api-docs");
    await expect(
      page.getByRole("heading", { name: "API Documentation", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.getByLabel("Example language").selectOption("python");
    const first = page.locator(".api-doc-code").first();
    await first.getByRole("button", { name: "Copy", exact: true }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
      "REPLACE_WITH_YOUR_API_KEY",
    );
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
      "requests.request",
    );
    await page
      .getByLabel("Search paths, scopes or operations")
      .fill("tasks:write");
    await expect(page.locator(".api-doc-operation")).toHaveCount(3);
    await expect(page.locator(".api-doc-operation").first()).toHaveAttribute(
      "open",
      "",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page
      .getByRole("navigation", { name: "Documentation" })
      .getByRole("button", { name: "Errors and retries", exact: true })
      .click();
    await expect(page.locator("#api-doc-errors")).toBeFocused();
    await page.screenshot({
      path: `test-results/api-docs-first-screen-${mobile ? "phone" : "desktop"}.png`,
    });
    await page.screenshot({
      path: `test-results/api-docs-${mobile ? "phone" : "desktop"}.png`,
      fullPage: true,
    });
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("link", { name: "Download OpenAPI" }).click();
    const download = await downloadPromise;
    const file = await download.path();
    expect(await readFile(file!, "utf8")).toBe(
      await readFile("docs/openapi-public-api.json", "utf8"),
    );
    expect(requests).toEqual([]);
    await page
      .getByRole("link", { name: "API Key settings", exact: true })
      .first()
      .click();
    await expect(page.getByLabel("Email", { exact: true })).toBeVisible(); // Settings still requires login.
  });

test("Arabic RTL documentation remains usable with expanded examples on phone", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem("language", "ar"));
  await page.route(
    (url) => url.protocol === "https:",
    (r) => r.abort(),
  );
  await page.goto("/#/api-docs");
  await expect(
    page.getByRole("heading", { name: "بداية سريعة", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/api-docs-ar-first.png" });
  await page.getByLabel("ابحث عن مسار أو صلاحية أو عملية").fill("tasks:write");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(page.locator("article.api-docs")).toHaveAttribute("dir", "rtl");
  await page
    .locator(".api-doc-operation")
    .first()
    .screenshot({ path: "test-results/api-docs-ar-operation.png" });
});

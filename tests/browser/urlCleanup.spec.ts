import { test, expect } from "@playwright/test";

test("obsolete callback is cleaned before application JavaScript loads", async ({
  page,
}) => {
  await page.route("**/assets/*.js", (route) => route.abort());
  await page.addInitScript(() =>
    history.replaceState({ navigation: "preserve" }, "", location.href),
  );
  await page.goto(
    "/?code=synthetic-callback&state=synthetic-state&source=keep#/library?view=trash",
    { waitUntil: "domcontentloaded" },
  );
  const url = new URL(page.url());
  expect(url.search).toBe("?source=keep");
  expect(url.hash).toBe("#/library?view=trash");
  expect(await page.evaluate(() => history.state)).toEqual({
    navigation: "preserve",
  });
});
test("cleanup leaves the normal sign-in screen usable", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("language", "en"));
  await page.goto("/?code=synthetic-callback&state=synthetic-state#/library");
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
  expect(new URL(page.url()).search).toBe("");
});

import { test, expect } from "@playwright/test";
import { prepareUniversityPilot } from "./universityFixture";
import { writeFile } from "node:fs/promises";
async function login(
  page: import("@playwright/test").Page,
  c: { email: string; password: string; uid: string },
) {
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
  await expect(page.locator(".side-navigation")).toBeVisible({
    timeout: 15000,
  });
}
test("admin has a bell instead of Work hub; read state reloads and unopened card details do not mount", async ({
  page,
  request,
}) => {
  test.setTimeout(90000);
  const c = await prepareUniversityPilot(request);
  const id = "n".repeat(20);
  await request.patch(
    "http://127.0.0.1:8080/v1/projects/demo-where-i-left-off/databases/(default)/documents/users/" +
      c.uid +
      "/projects/" +
      id,
    {
      headers: { Authorization: "Bearer owner" },
      data: {
        fields: {
          name: { stringValue: "Notification target" },
          nextStep: { stringValue: "Next action" },
          status: { stringValue: "later" },
          rank: { integerValue: "0" },
          revision: { integerValue: "0" },
          mutationId: { stringValue: "fixture" },
        },
      },
    },
  );
  let read = 0;
  const created = Date.now() - 1000;
  await page.route("**/push-config.json", (r) =>
    r.fulfill({
      json: { endpoint: "https://notification-pilot.workers.dev/" },
    }),
  );
  await page.route("https://notification-pilot.workers.dev/", async (r) => {
    const d = r.request().postDataJSON();
    if (d.action === "notifications-read") {
      read = d.through;
      await r.fulfill({ json: { result: { ok: true } } });
      return;
    }
    await r.fulfill({
      json: {
        result:
          d.action === "notifications"
            ? {
                items: [
                  {
                    id: "one",
                    title: "Task reminder",
                    body: "Notification target",
                    url: "#/personal/" + id,
                    created_at: created,
                  },
                ],
                unread: read >= created ? 0 : 1,
                lastRead: read,
                checkedAt: Date.now(),
              }
            : { preferences: { enabled: false }, cards: {}, publicKey: "" },
      },
    });
  });
  await login(page, c);
  await expect(
    page.getByRole("button", { name: "Work hub", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".pilot-dock,.pilot-dialog")).toHaveCount(0);
  await expect(page.locator(".envelope-content h2")).toHaveCount(0);
  const card = page.locator('[data-project-id="' + id + '"]');
  await card.hover();
  await card
    .getByRole("button", {
      name: "Expand card: Notification target",
      exact: true,
    })
    .click();
  await expect(card.locator(".envelope-content h2")).toBeVisible();
  await card
    .getByRole("button", { name: "Collapse card", exact: true })
    .click();
  await card.hover();
  await card
    .getByRole("button", {
      name: "Expand card: Notification target",
      exact: true,
    })
    .click();
  await expect(card.locator(".envelope-content h2")).toBeVisible();
  await expect(page.locator(".notification-badge")).toHaveText("1");
  await page
    .getByRole("button", { name: "Notifications", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Notifications",
    exact: true,
  });
  await expect(dialog).toContainText("Task reminder");
  await dialog
    .getByRole("button", { name: "Mark all as read", exact: true })
    .click();
  await expect(page.locator(".notification-badge")).toHaveCount(0);
  await dialog
    .getByRole("button", { name: "Close notifications", exact: true })
    .click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Notifications", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".notification-badge")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Notifications", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Notifications", exact: true })
    .getByRole("link")
    .filter({ hasText: "Task reminder" })
    .click();
  await expect(page).toHaveURL(new RegExp("personal/" + id));
  await expect(
    page.getByRole("dialog", { name: "Notifications", exact: true }),
  ).toHaveCount(0);
  const frame = await page.evaluate(async () => {
    const gaps: number[] = [];
    let last = performance.now();
    for (let i = 0; i < 90; i++)
      await new Promise<void>((resolve) =>
        requestAnimationFrame((now) => {
          gaps.push(now - last);
          last = now;
          window.scrollTo(0, (i % 20) * 30);
          resolve();
        }),
      );
    gaps.sort((a, b) => a - b);
    return {
      medianMs: gaps[45],
      p95Ms: gaps[85],
      samples: gaps.length,
      domNodes: document.querySelectorAll("*").length,
    };
  });
  await writeFile(
    ".wrangler/simplified-frame-sample.json",
    JSON.stringify(frame, null, 2),
  );
  await page.screenshot({
    path: ".wrangler/simplified-desktop.png",
    fullPage: false,
  });
});
test("ordinary accounts keep public navigation without the admin bell", async ({
  page,
  request,
}) => {
  const c = await prepareUniversityPilot(
    request,
    "ordinary-notifications@example.test",
  );
  await login(page, c);
  await expect(
    page.getByRole("button", { name: "Notifications", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Work hub", exact: true }),
  ).toHaveCount(0);
});

test("many collapsed cards defer details and the Arabic notification drawer fits a phone", async ({
  page,
  request,
}) => {
  test.setTimeout(90000);
  const c = await prepareUniversityPilot(request);
  for (let i = 0; i < 50; i++) {
    const id = "perf" + String(i).padStart(16, "0");
    await request.patch(
      "http://127.0.0.1:8080/v1/projects/demo-where-i-left-off/databases/(default)/documents/users/" +
        c.uid +
        "/projects/" +
        id,
      {
        headers: { Authorization: "Bearer owner" },
        data: {
          fields: {
            name: { stringValue: "Performance card " + i },
            nextStep: { stringValue: "A useful next step" },
            description: { stringValue: "Card description ".repeat(50) },
            checklist: { stringValue: "[ ] A task\n".repeat(80) },
            status: { stringValue: "later" },
            rank: { integerValue: String(i * 1024) },
            revision: { integerValue: "0" },
            mutationId: { stringValue: "fixture" },
          },
        },
      },
    );
  }
  await page.route("**/push-config.json", (r) =>
    r.fulfill({
      json: { endpoint: "https://notification-pilot.workers.dev/" },
    }),
  );
  await page.route("https://notification-pilot.workers.dev/", (r) =>
    r.fulfill({
      json: {
        result:
          r.request().postDataJSON().action === "notifications"
            ? { items: [], unread: 0, lastRead: 0, checkedAt: Date.now() }
            : { preferences: { enabled: false }, cards: {}, publicKey: "" },
      },
    }),
  );
  await login(page, c);
  await expect
    .poll(() => page.locator(".envelope-summary").count())
    .toBeGreaterThanOrEqual(50);
  await expect(page.locator(".envelope-content h2")).toHaveCount(0);
  const metrics = await page.evaluate(async () => {
    const times: number[] = [];
    let last = performance.now();
    for (let i = 0; i < 90; i++)
      await new Promise<void>((resolve) =>
        requestAnimationFrame((now) => {
          times.push(now - last);
          last = now;
          scrollTo(0, i * 24);
          resolve();
        }),
      );
    times.sort((a, b) => a - b);
    return {
      cards: document.querySelectorAll(".envelope-summary").length,
      domNodes: document.querySelectorAll("*").length,
      unopenedDetails: document.querySelectorAll(".envelope-content h2").length,
      medianMs: times[45],
      p95Ms: times[85],
    };
  });
  await writeFile(
    ".wrangler/simplified-many-cards.json",
    JSON.stringify(metrics, null, 2),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => scrollTo(0, 0));
  await page.getByRole("button", { name: "العربية", exact: true }).click();
  await page.getByRole("button", { name: "الإشعارات", exact: true }).click();
  const panel = page.getByRole("dialog", { name: "الإشعارات", exact: true });
  await expect(panel).toContainText("لا توجد إشعارات بعد");
  const box = (await panel.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: ".wrangler/simplified-phone.png",
    fullPage: false,
  });
  await panel
    .getByRole("button", { name: "إغلاق الإشعارات", exact: true })
    .click();
});

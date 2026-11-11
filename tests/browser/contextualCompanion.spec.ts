import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { prepareUniversityPilot } from "./universityFixture";
const card = "c".repeat(20);
const day = 86400000;
async function idleForSuggestion(page: import("@playwright/test").Page) {
  await page.bringToFront();
  await page.locator("#wilo-main").focus();
  await page.clock.runFor(6000);
  await page.clock.fastForward(35000);
  await page.clock.runFor(1000);
  // Firestore snapshot delivery uses real I/O; advance scheduler ticks until
  // React has consumed the authorized feed, rather than freezing after one tick.
  await expect
    .poll(
      async () => {
        if (await page.locator(".context-companion").count()) return true;
        await page.clock.runFor(5000);
        return (await page.locator(".context-companion").count()) > 0;
      },
      { timeout: 15000 },
    )
    .toBe(true);
}
async function seedCard(
  request: import("@playwright/test").APIRequestContext,
  uid: string,
  due: string,
) {
  await request.patch(
    `http://127.0.0.1:8080/v1/projects/demo-where-i-left-off/databases/(default)/documents/users/${uid}/projects/${card}`,
    {
      headers: { Authorization: "Bearer owner" },
      data: {
        fields: {
          name: { stringValue: "A useful draft" },
          nextStep: { stringValue: "Review the next step" },
          status: { stringValue: "later" },
          dueDate: { stringValue: due },
          rank: { integerValue: "0" },
          revision: { integerValue: "0" },
          mutationId: { stringValue: "synthetic-companion" },
        },
      },
    },
  );
}
async function signIn(
  page: import("@playwright/test").Page,
  c: { uid: string; email: string; password: string },
  category: "deadlines" | "stale" | "features" | "extension",
) {
  await page.addInitScript(
    ({ uid, category, card }) => {
      localStorage.setItem("language", "en");
      localStorage.setItem("welcome-tour:v2:" + uid, "done");
      localStorage.setItem("idle-sleep:" + uid, "off");
      localStorage.setItem(
        "wilo-experience:v1:" + uid,
        JSON.stringify({ sound: false, motion: false }),
      );
      if (!localStorage.getItem("wilo-companion:v1:" + uid))
        localStorage.setItem(
          "wilo-companion:v1:" + uid,
          JSON.stringify({
            preferences: {
              enabled: true,
              deadlines: category === "deadlines",
              stale: category === "stale",
              features: category === "features",
              extension: category === "extension",
              frequency: "gentle",
            },
            visits:
              category === "stale"
                ? { ["card:" + card]: Date.now() - 20 * 86400000 }
                : {},
            seen: {},
            shown: [],
            pausedUntil: 0,
          }),
        );
    },
    { uid: c.uid, category, card },
  );
  await page.route("**/push-config.json", (route) =>
    route.fulfill({ status: 503, body: "{}" }),
  );
  await page.clock.install({ time: new Date() });
  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill(c.email);
  await page.locator(".auth-continue").click();
  await page.getByLabel("Password", { exact: true }).fill(c.password);
  await page
    .locator("form")
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  await expect(page.locator(".workspace-command-bar")).toBeVisible({
    timeout: 15000,
  });
}
for (const phone of [false, true])
  test(`contextual deadline and persistent opt-out — ${phone ? "phone" : "desktop"}`, async ({
    page,
    request,
  }) => {
    await page.setViewportSize(
      phone ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
    );
    const c = await prepareUniversityPilot(
      request,
      `companion-deadline-${phone}@example.test`,
    );
    await seedCard(
      request,
      c.uid,
      new Date(Date.now() + 2 * day).toISOString().slice(0, 10),
    );
    await signIn(page, c, "deadlines");
    await expect(page.locator(`[data-project="${card}"]`)).toBeVisible();
    await expect(page.locator(".extension-prompt")).toHaveCount(0);
    await idleForSuggestion(page);
    const hint = page.getByRole("complementary", { name: "Wilo companion" });
    await expect(hint).toBeVisible();
    await expect(hint).toContainText("A useful draft");
    await expect(hint).toHaveAttribute("data-companion-kind", "deadlines");
    const box = (await hint.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(phone ? 390 : 1440);
    const axe = await new AxeBuilder({ page })
      .include(".context-companion")
      .withRules(["color-contrast"])
      .analyze();
    expect(axe.violations).toEqual([]);
    await page.screenshot({
      path: `/tmp/wilo-context-companion-${phone ? "phone" : "desktop"}.png`,
    });
    await hint.getByRole("button", { name: "Show me", exact: true }).click();
    await expect(page.locator(".card-detail-panel")).toBeVisible();
    await page.keyboard.press("Escape");
    await page.goto("/#/settings");
    const settings = page
      .locator(".settings-group")
      .filter({ has: page.locator(".companion-settings") });
    await settings.locator("summary").click();
    await settings
      .getByLabel("Enable companion suggestions", { exact: true })
      .uncheck();
    await expect(settings.locator("fieldset input").first()).toBeDisabled();
    await page.reload();
    await page.goto("/#/personal");
    await page.clock.fastForward(40000);
    await expect(hint).toHaveCount(0);
    expect(
      await page.evaluate(
        (uid) =>
          JSON.parse(localStorage.getItem("wilo-companion:v1:" + uid)!)
            .preferences.enabled,
        c.uid,
      ),
    ).toBe(false);
  });
test("known stale visit and one-time feature explanation use real controls", async ({
  page,
  request,
}) => {
  const c = await prepareUniversityPilot(
    request,
    "companion-stale@example.test",
  );
  await seedCard(request, c.uid, "");
  await signIn(page, c, "stale");
  await expect(page.locator(`[data-project="${card}"]`)).toBeVisible();
  await idleForSuggestion(page);
  const hint = page.locator(".context-companion");
  await expect(hint).toHaveAttribute("data-companion-kind", "stale");
  await hint.getByRole("button", { name: "Show me", exact: true }).click();
  await expect(page.locator(".card-detail-panel")).toBeVisible();
  expect(
    await page.evaluate(
      ({ uid, card }) =>
        JSON.parse(localStorage.getItem("wilo-companion:v1:" + uid)!).visits[
          "card:" + card
        ],
      { uid: c.uid, card },
    ),
  ).toBeGreaterThan(Date.now() - day);
});
test("new feature points to color settings once", async ({ page, request }) => {
  const c = await prepareUniversityPilot(
    request,
    "companion-feature@example.test",
  );
  await signIn(page, c, "features");
  await idleForSuggestion(page);
  const hint = page.locator(".context-companion");
  await expect(hint).toHaveAttribute("data-companion-kind", "features");
  await hint
    .getByRole("button", { name: "Try color mode", exact: true })
    .click();
  await expect(page.locator(".color-mode-options")).toBeVisible();
  await expect(page.locator(".color-mode-options")).toHaveClass(
    /companion-attention/,
  );
  await expect(page.locator(".companion-pointer")).toBeVisible();
  await page.goto("/#/personal");
  await page.clock.fastForward(40000);
  await expect(hint).toHaveCount(0);
});
test("university suggestion opens its own assignment without saving anything", async ({
  page,
  request,
}) => {
  const c = await prepareUniversityPilot(
      request,
      "companion-university@example.test",
    ),
    course = {
      id: "companion-course",
      name: "A real test course",
      notes: "",
      url: "",
      requires: [],
      topics: [],
      x: 0,
      y: 0,
    },
    task = {
      id: "companion-task",
      courseId: course.id,
      title: "Assignment due soon",
      kind: "assignment",
      due: new Date(Date.now() + day).toISOString(),
      done: false,
      notes: "",
      url: "",
    };
  for (const [kind, item] of [
    ["courses", course],
    ["tasks", task],
  ] as const)
    await request.patch(
      `http://127.0.0.1:8080/v1/projects/demo-where-i-left-off/databases/(default)/documents/users/${c.uid}/studyRecords/${kind}_${item.id}`,
      {
        headers: { Authorization: "Bearer owner" },
        data: {
          fields: {
            kind: { stringValue: kind },
            id: { stringValue: item.id },
            payload: { stringValue: JSON.stringify(item) },
            deleted: { booleanValue: false },
            revision: { integerValue: "0" },
            mutationId: { stringValue: "synthetic-companion" },
            updatedAt: { timestampValue: new Date().toISOString() },
          },
        },
      },
    );
  await signIn(page, c, "deadlines");
  await page.goto("/#/university");
  await expect(page.locator(".uni-course-card")).toContainText(course.name);
  await idleForSuggestion(page);
  const hint = page.locator(".context-companion");
  await expect(hint).toContainText(task.title);
  await hint.getByRole("button", { name: "Show me", exact: true }).click();
  await expect(page.locator(".study-dialog")).toBeVisible();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue(
    task.title,
  );
});

import { expect, test } from "@playwright/test";
import type { Page, APIRequestContext } from "@playwright/test";
import { readFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { prepareUniversityPilot } from "./universityFixture";

async function signIn(page: Page, request: APIRequestContext, email?: string) {
  const account = await prepareUniversityPilot(request, email);
  await page.addInitScript(() => localStorage.setItem("language", "en"));
  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(account.password);
  await page
    .locator("form")
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  await expect(page.locator(".side-navigation-toggle")).toBeVisible();
  const skip = page.locator(".welcome-guide .guide-skip");
  if (await skip.isVisible()) await skip.click();
  return account;
}
async function openStudio(page: Page, screen = "today") {
  await page.goto("/#/admin/studio?screen=" + screen);
  await expect(page.locator(".wilo-studio")).toBeVisible();
}
async function projectCount(request: APIRequestContext, uid: string) {
  const response = await request.get(
    "http://127.0.0.1:8080/v1/projects/demo-where-i-left-off/databases/(default)/documents/users/" +
      uid +
      "/projects",
    { headers: { Authorization: "Bearer owner" } },
  );
  expect(response.ok()).toBe(true);
  return ((await response.json()).documents || []).length;
}
test("admin preview is isolated, supports quick creation, atomic bulk work, recovery and two tabs", async ({
  page,
  request,
  context,
}) => {
  const { uid } = await signIn(page, request),
    before = await projectCount(request, uid);
  await page.goto("/#/admin");
  await page
    .getByRole("link", { name: "Try the new WILO", exact: true })
    .click();
  await expect(page.locator(".wilo-studio")).toBeVisible();
  await page
    .locator(".st-sidebar")
    .getByRole("button", { name: "My work", exact: true })
    .click();
  await page
    .locator(".st-main")
    .getByRole("button", { name: "New card", exact: true })
    .click();
  const form = page.getByRole("dialog");
  await form.getByLabel("Title", { exact: true }).fill("Private preview card");
  await form
    .getByLabel("Next step", { exact: true })
    .fill("Only in the preview");
  await form.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Private preview card", exact: true }),
  ).toBeVisible();
  await expect.poll(() => projectCount(request, uid)).toBe(before);
  await page
    .locator(".st-topbar")
    .getByRole("button", { name: "Undo", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Private preview card", exact: true }),
  ).toHaveCount(0);
  await page
    .locator(".st-topbar")
    .getByRole("button", { name: "Redo", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Private preview card", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Private preview card", exact: true }),
  ).toBeVisible();
  const second = await context.newPage();
  await openStudio(second, "projects");
  await page
    .getByRole("button", { name: "Select Private preview card", exact: true })
    .click();
  await page
    .locator(".st-bulk")
    .getByRole("button", { name: "Archive", exact: true })
    .click();
  await expect(
    second.getByRole("heading", { name: "Private preview card", exact: true }),
  ).toHaveCount(0);
  await second.close();
  await page
    .locator(".st-sidebar")
    .getByRole("button", { name: "Settings", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Save recovery point", exact: true })
    .click();
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await expect(page.locator(".wilo-studio")).toHaveAttribute(
    "data-mode",
    "dark",
  );
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Restore recovery point", exact: true })
    .click();
  await expect(page.locator(".wilo-studio")).toHaveAttribute(
    "data-mode",
    "light",
  );
  await page.locator(".st-setting-language select").selectOption("ar");
  await expect(page.locator(".wilo-studio")).toHaveAttribute("dir", "rtl");
  await page.locator(".st-preview-strip").getByRole("link").click();
  await expect(page.locator(".admin-dashboard")).toBeVisible();
  await expect(page.locator(".wilo-studio")).toHaveCount(0);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  expect(await projectCount(request, uid)).toBe(before);
});
test("university routes, notes, semesters, agenda, calendar and global search work across reload", async ({
  page,
  request,
}) => {
  await signIn(page, request);
  await openStudio(page, "university");
  await page
    .locator(".st-course-nav-item")
    .filter({ hasText: "Algorithms" })
    .click();
  await page
    .locator(".st-course-panel")
    .getByRole("button", { name: "Notes & materials", exact: true })
    .click();
  await expect(page.locator(".st-long-note a")).toHaveAttribute(
    "href",
    "https://ocw.mit.edu/",
  );
  const url = page.url();
  await page.reload();
  await expect(page.locator(".st-long-note")).toBeVisible();
  expect(page.url()).toBe(url);
  await page
    .locator(".st-course-panel")
    .getByRole("button", { name: "Study plan", exact: true })
    .click();
  const topic = page.locator(".st-topic input").nth(1);
  await topic.check();
  await expect(page.locator(".st-toast")).toContainText(
    "Saved in your private preview",
  );
  await page.reload();
  await expect(page.locator(".st-topic input").nth(1)).toBeChecked();
  await page.locator(".st-topbar .st-export-menu summary").click();
  const downloadPromise = page.waitForEvent("download");
  await page
    .locator(".st-topbar .st-export-menu")
    .getByRole("button", { name: "Calendar (.ics)", exact: true })
    .click();
  const file = await downloadPromise;
  expect(file.suggestedFilename()).toBe("wilo-preview.ics");
  expect(await readFile((await file.path())!, "utf8")).toContain(
    "BEGIN:VCALENDAR",
  );
  await page.locator(".st-topbar .st-export-menu summary").click();
  await page
    .locator(".st-university>.st-section-header")
    .getByRole("button", { name: "Timetable", exact: true })
    .click();
  await expect(page.locator(".st-week-grid")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .locator(".st-schedule")
    .getByRole("button", { name: "Daily agenda", exact: true })
    .click();
  await expect(page.locator(".st-day-picker")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.locator(".st-global-search").click();
  await page.getByRole("dialog").getByRole("textbox").fill("Algorithms");
  await expect(page.locator(".st-palette-results")).toContainText("Algorithms");
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/#/admin/studio?screen=university");
  await page.getByRole("button", { name: "New semester", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Name", { exact: true })
    .fill("Old semester");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await page
    .locator(".st-course-nav-item")
    .filter({ hasText: "Algorithms" })
    .click();
  await page
    .locator(".st-course-heading")
    .getByLabel("Semester", { exact: true })
    .selectOption({ label: "Old semester" });
  await page
    .locator(".st-course-nav")
    .getByLabel("Semester", { exact: true })
    .selectOption({ label: "Old semester" });
  await page
    .getByRole("button", { name: "Archive semester", exact: true })
    .click();
  await expect(page.locator(".st-course-nav-item")).toHaveCount(1);
  await page
    .locator(".st-course-nav")
    .getByLabel("Semester", { exact: true })
    .selectOption("current");
  await expect(
    page.locator(".st-course-nav-item").filter({ hasText: "Algorithms" }),
  ).toHaveCount(0);
  await page
    .locator(".st-topbar")
    .getByRole("button", { name: "Undo", exact: true })
    .click();
  await expect(
    page.locator(".st-course-nav-item").filter({ hasText: "Algorithms" }),
  ).toBeVisible();
});
test("admin layouts cover every screen in three languages, both themes, motion preference and keyboard", async ({
  page,
  request,
}) => {
  test.setTimeout(180000);
  await signIn(page, request);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openStudio(page, "settings");
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const language of ["en", "ar", "he"]) {
    await page.goto("/#/admin/studio?screen=settings");
    await page.locator(".st-setting-language select").selectOption(language);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const screen of [
        "today",
        "projects",
        "university",
        "groups",
        "library",
        "analytics",
        "settings",
      ]) {
        await page.goto("/#/admin/studio?screen=" + screen);
        await expect(page.locator(".st-main h1")).toBeVisible();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        if (
          language === "ar" &&
          ["today", "projects", "university", "analytics", "settings"].includes(
            screen,
          )
        )
          await page.screenshot({
            path: `test-results/studio/${screen}-${width}.png`,
            fullPage: true,
          });
      }
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/#/admin/studio?screen=settings");
  await page.locator(".st-setting-language select").selectOption("en");
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await expect(page.locator(".wilo-studio")).toHaveAttribute(
    "data-mode",
    "dark",
  );
  await page.goto("/#/admin/studio?screen=today");
  await page.screenshot({
    path: "test-results/studio/dark-desktop.png",
    fullPage: true,
  });
  await page.keyboard.press("Control+k");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const accessibility = await new AxeBuilder({ page })
    .include(".wilo-studio")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  expect(errors).toEqual([]);
});
test("non-admin accounts cannot enter the studio or find its administrative entry", async ({
  page,
  request,
}) => {
  await signIn(page, request, "studio-student@example.test");
  await page.goto("/#/admin/studio");
  await expect(page.locator(".wilo-studio")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Try the new WILO", exact: true }),
  ).toHaveCount(0);
  await page.goto("/#/personal");
  await expect(page.locator(".workspace-toolbar")).toBeVisible();
  await expect(page.locator(".st-mobile-nav")).toHaveCount(0);
});

test("assistant persists conversations, validates compound proposals, saves only in the preview and cancels late output", async ({
  page,
  request,
}) => {
  test.setTimeout(90000);
  const { uid } = await signIn(page, request),
    before = await projectCount(request, uid);
  await page.evaluate(
    (uid) =>
      sessionStorage.setItem(
        "wilo-pollinations:" + uid,
        "studio-test-only-token",
      ),
    uid,
  );
  let mode = "greeting";
  await page.route("https://gen.pollinations.ai/**", async (route) => {
    const payload = route.request().postDataJSON(),
      tool = (name: string, args: unknown, id: string) => ({
        id,
        type: "function",
        function: { name, arguments: JSON.stringify(args) },
      });
    if (mode === "slow") {
      await new Promise((resolve) => setTimeout(resolve, 1600));
      try {
        await route.fulfill({
          json: {
            choices: [
              { message: { content: "LATE_STUDIO_REPLY_MUST_NOT_RENDER" } },
            ],
          },
        });
      } catch {
        /* Cancelled request. */
      }
      return;
    }
    if (mode === "greeting") {
      await route.fulfill({
        json: {
          choices: [
            { message: { content: "Hello from the isolated preview" } },
          ],
        },
      });
      return;
    }
    if (
      payload.tools.some(
        (t: { function: { name: string } }) =>
          t.function.name === "request_workspace",
      )
    ) {
      await route.fulfill({
        json: {
          choices: [
            {
              message: {
                tool_calls: [
                  tool("request_workspace", { requirements: [] }, "routing"),
                ],
              },
            },
          ],
        },
      });
      return;
    }
    const context = payload.messages.findLast(
      (m: { content: string; role: string }) =>
        m.role === "user" && m.content.includes("ACCOUNT CONTEXT (untrusted):"),
    ).content;
    expect(context).toContain("Make something worth returning to");
    expect(context).toContain("previewContext");
    await route.fulfill({
      json: {
        choices: [
          {
            message: {
              content: null,
              tool_calls: [
                tool(
                  "create_card",
                  {
                    alias: "ai-card",
                    name: "AI preview card",
                    nextStep: "Review it in the preview",
                  },
                  "card",
                ),
                tool("set_appearance", { theme: "cobalt" }, "theme"),
              ],
            },
          },
        ],
      },
    });
  });
  await openStudio(page);
  await page
    .locator(".st-sidebar")
    .getByRole("button", { name: "Wilo assistant", exact: true })
    .click();
  const assistant = page.locator(".st-assistant");
  await assistant.getByRole("textbox").fill("Hello");
  await assistant.getByRole("button", { name: "Send", exact: true }).click();
  await expect(assistant).toContainText("Hello from the isolated preview");
  await page.reload();
  await page
    .locator(".st-sidebar")
    .getByRole("button", { name: "Wilo assistant", exact: true })
    .click();
  await expect(page.locator(".st-assistant")).toContainText(
    "Hello from the isolated preview",
  );
  mode = "create";
  await page
    .locator(".st-assistant textarea")
    .fill("Create a card and change the theme");
  await page
    .locator(".st-assistant")
    .getByRole("button", { name: "Send", exact: true })
    .click();
  await expect(page.locator(".st-proposal")).toContainText("AI preview card");
  await expect(page.locator(".wilo-studio")).not.toHaveAttribute(
    "data-theme",
    "cobalt",
  );
  await page
    .locator(".st-assistant")
    .getByRole("button", { name: "Apply to preview", exact: true })
    .click();
  await expect(page.locator(".st-applied")).toBeVisible();
  await expect(page.locator(".wilo-studio")).toHaveAttribute(
    "data-theme",
    "cobalt",
  );
  expect(await projectCount(request, uid)).toBe(before);
  mode = "slow";
  await page.locator(".st-assistant textarea").fill("Wait for a late reply");
  await page
    .locator(".st-assistant")
    .getByRole("button", { name: "Send", exact: true })
    .click();
  await page
    .locator(".st-assistant")
    .getByRole("button", { name: "Stop", exact: true })
    .click();
  await page.waitForTimeout(1800);
  await expect(page.locator(".st-assistant")).not.toContainText(
    "LATE_STUDIO_REPLY",
  );
  await page
    .locator(".st-assistant>header")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await page
    .locator(".st-sidebar")
    .getByRole("button", { name: "My work", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "AI preview card", exact: true }),
  ).toBeVisible();
  await page
    .locator(".st-topbar")
    .getByRole("button", { name: "Undo", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "AI preview card", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".wilo-studio")).toHaveAttribute(
    "data-theme",
    "emerald",
  );
});

test("copy, import and corrupted-preview recovery never write back to the public account", async ({
  page,
  request,
}) => {
  const { uid } = await signIn(page, request),
    before = await projectCount(request, uid);
  await page.goto("/#/personal");
  await page.getByRole("button", { name: "New card", exact: true }).click();
  await page
    .getByLabel("Card title", { exact: true })
    .fill("Original account sentinel");
  await page.getByRole("button", { name: "Save card", exact: true }).click();
  await expect.poll(() => projectCount(request, uid)).toBe(before + 1);
  await expect(page.locator(".sync-status")).toContainText(/saved|synced/i);
  await openStudio(page, "settings");
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Copy my account into preview", exact: true })
    .click();
  await expect(page.locator(".st-toast")).toContainText(
    "Saved in your private preview",
  );
  await page.goto("/#/admin/studio?screen=projects");
  await expect(
    page.getByRole("heading", {
      name: "Original account sentinel",
      exact: true,
    }),
  ).toBeVisible();
  await page.locator(".st-topbar .st-export-menu summary").click();
  const download = page.waitForEvent("download");
  await page
    .locator(".st-topbar .st-export-menu")
    .getByRole("button", { name: "Full backup (.json)", exact: true })
    .click();
  const file = await download;
  const exported = JSON.parse(await readFile((await file.path())!, "utf8"));
  expect(exported.format).toBe("wilo-studio-v1");
  exported.state.data.scopes[0].projects[0].name = "Imported into preview only";
  await page.goto("/#/admin/studio?screen=settings");
  await page.locator(".st-file-button input").setInputFiles({
    name: "preview.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(exported)),
  });
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Restore", exact: true })
    .click();
  await page.goto("/#/admin/studio?screen=projects");
  await expect(
    page.getByRole("heading", {
      name: "Imported into preview only",
      exact: true,
    }),
  ).toBeVisible();
  expect(await projectCount(request, uid)).toBe(before + 1);
  await page.evaluate((uid) => {
    const key = Object.keys(localStorage).find(
      (key) =>
        key.startsWith("wilo-admin-studio-v1/") && key.endsWith("/" + uid),
    );
    if (!key) throw new Error("No preview journal");
    localStorage.setItem(key, '{"corrupted":true}');
  }, uid);
  await page.reload();
  await expect(page.locator(".st-load-recovery")).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Reset to demo data", exact: true })
    .click();
  await expect(page.locator(".st-load-recovery")).toHaveCount(0);
  await expect(page.locator(".wilo-studio")).toBeVisible();
  await page.goto("/#/personal");
  await expect(
    page.getByRole("heading", {
      name: "Original account sentinel",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Imported into preview only",
      exact: true,
    }),
  ).toHaveCount(0);
});

test("card drag order, URL filters, section editing and safe course deletion remain reversible", async ({
  page,
  request,
}) => {
  await signIn(page, request);
  await openStudio(page, "projects");
  const firstId = await page
    .locator(".st-project-card")
    .first()
    .getAttribute("data-studio-card");
  const handle = await page.locator(".st-drag-handle").first().boundingBox(),
    target = await page.locator(".st-sortable").nth(1).boundingBox();
  await page.mouse.move(
    handle!.x + handle!.width / 2,
    handle!.y + handle!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    target!.x + target!.width / 2,
    target!.y + target!.height / 2,
    { steps: 12 },
  );
  await page.mouse.up();
  await expect(page.locator(".st-project-card").first()).not.toHaveAttribute(
    "data-studio-card",
    firstId!,
  );
  await page.reload();
  await expect(page.locator(".st-project-card").first()).not.toHaveAttribute(
    "data-studio-card",
    firstId!,
  );
  const search = page.locator(".st-workspace-tools input[type=search]");
  await search.fill("Follow up");
  await expect(page.locator(".st-project-card")).toHaveCount(1);
  await page.reload();
  await expect(
    page.locator(".st-workspace-tools input[type=search]"),
  ).toHaveValue("Follow up");
  await expect(page.locator(".st-project-card")).toHaveCount(1);
  await page.locator(".st-workspace-tools input[type=search]").fill("");
  await expect(page.locator(".st-project-card")).toHaveCount(4);
  await page.goBack();
  await expect(
    page.locator(".st-workspace-tools input[type=search]"),
  ).toHaveValue("Follow up");
  await page.goto("/#/admin/studio?screen=projects");
  await page
    .locator(".st-section-pills")
    .getByRole("button", { name: /Projects/ })
    .click();
  await page.locator(".st-section-pills .st-more summary").click();
  await page
    .locator(".st-section-pills .st-more")
    .getByRole("button", { name: /Edit/ })
    .click();
  await expect(
    page.getByRole("dialog").getByLabel("Name", { exact: true }),
  ).toHaveValue("Projects");
  await page
    .getByRole("dialog")
    .getByLabel("Name", { exact: true })
    .fill("Renamed section");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await expect(page.locator(".st-section-pills")).toContainText(
    "Renamed section",
  );
  await page.goto("/#/admin/studio?screen=university");
  await page
    .locator(".st-course-nav-item")
    .filter({ hasText: "Algorithms" })
    .click();
  await page
    .locator(".st-course-heading")
    .getByRole("button", { name: "Edit Algorithms", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete", exact: true })
    .click();
  await expect(page.locator(".st-toast")).toContainText("Move or delete");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await page
    .locator(".st-university>.st-section-header")
    .getByRole("button", { name: "New course", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Name", { exact: true })
    .fill("Disposable course");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await page
    .locator(".st-course-nav-item")
    .filter({ hasText: "Disposable course" })
    .click();
  await page
    .locator(".st-course-heading")
    .getByRole("button", { name: "Edit Disposable course", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete", exact: true })
    .click();
  await expect(
    page
      .locator(".st-course-nav-item")
      .filter({ hasText: "Disposable course" }),
  ).toHaveCount(0);
  await page
    .locator(".st-topbar")
    .getByRole("button", { name: "Undo", exact: true })
    .click();
  await expect(
    page
      .locator(".st-course-nav-item")
      .filter({ hasText: "Disposable course" }),
  ).toBeVisible();
});

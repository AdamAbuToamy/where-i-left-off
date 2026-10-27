import { test, expect } from "@playwright/test";
import type { Page, APIRequestContext } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { prepareUniversityPilot } from "./universityFixture";
async function signIn(
  page: Page,
  request: APIRequestContext,
  email?: string,
  language = "en",
) {
  const user = await prepareUniversityPilot(request, email);
  await page.addInitScript(() => localStorage.setItem("language", "en"));
  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page
    .locator("form")
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  await expect(page.locator(".side-navigation-toggle")).toBeVisible();
  const skip = page.locator(".welcome-guide .guide-skip");
  if (await skip.isVisible()) await skip.click();
  if (language !== "en")
    await page.evaluate((value) => {
      localStorage.setItem("language", value);
      window.dispatchEvent(
        new CustomEvent("language-changed", { detail: value }),
      );
    }, language);
  return user;
}
async function open(page: Page, screen = "university") {
  await page.goto("/#/admin/preview?screen=" + screen);
  await expect(page.locator(".admin-preview")).toBeVisible();
  const screenElement = page.locator('[data-preview-screen="' + screen + '"]');
  await expect(screenElement).toBeVisible();
  await expect(screenElement).toHaveCSS("opacity", "1");
}
async function count(request: APIRequestContext, uid: string) {
  const response = await request.get(
    "http://127.0.0.1:8080/v1/projects/demo-where-i-left-off/databases/(default)/documents/users/" +
      uid +
      "/projects",
    { headers: { Authorization: "Bearer owner" } },
  );
  expect(response.ok()).toBe(true);
  return ((await response.json()).documents || []).length;
}
test("original palette, private CRUD, hidden form values, undo, checkpoint and backup survive reload", async ({
  page,
  request,
  context,
}) => {
  const user = await signIn(page, request),
    before = await count(request, user.uid);
  await page.goto("/#/admin");
  await page
    .getByRole("link", {
      name: "Try original-interface improvements",
      exact: true,
    })
    .click();
  await expect(page.locator(".admin-preview")).toBeVisible();
  expect(
    await page
      .locator(".admin-preview")
      .evaluate((el) =>
        getComputedStyle(el).getPropertyValue("--site-primary").trim(),
      ),
  ).toBe("#385c4b");
  await page
    .locator(".preview-main-tabs")
    .getByRole("button", { name: "My cards", exact: true })
    .click();
  await expect(page.locator("[data-preview-project]").first()).toBeVisible();
  const initialOrder = await page
    .locator("[data-preview-project]")
    .evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("data-preview-project")),
    );
  const drag = page
    .locator('.preview-project button[aria-roledescription="sortable"]')
    .first();
  const from = await drag.boundingBox(),
    to = await page
      .locator('.preview-project button[aria-roledescription="sortable"]')
      .nth(1)
      .boundingBox();
  if (!from || !to) throw new Error("Missing drag targets");
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, {
    steps: 20,
  });
  await page.mouse.up();
  await expect
    .poll(() =>
      page
        .locator("[data-preview-project]")
        .evaluateAll((elements) =>
          elements.map((element) =>
            element.getAttribute("data-preview-project"),
          ),
        ),
    )
    .toEqual([initialOrder[1], initialOrder[0], ...initialOrder.slice(2)]);
  await page.getByRole("button", { name: "Add card", exact: true }).click();
  const form = page.locator(".preview-dialog");
  await form
    .getByLabel("Name", { exact: true })
    .fill("Original-style private card");
  await form
    .getByLabel("Next step", { exact: true })
    .fill("Keep the original identity");
  await form.getByRole("button", { name: "More details", exact: true }).click();
  await form
    .getByLabel("Notes", { exact: true })
    .fill("Notes survive closing the panel");
  await form
    .getByLabel("Link", { exact: true })
    .fill("https://example.test/preview");
  await form.getByRole("button", { name: "More details", exact: true }).click();
  await form.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Original-style private card",
      exact: true,
    }),
  ).toBeVisible();
  await expect.poll(() => count(request, user.uid)).toBe(before);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Original-style private card",
      exact: true,
    }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Original-style private card",
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  const card = page.locator(".preview-project").filter({
    has: page.getByRole("heading", {
      name: "Original-style private card",
      exact: true,
    }),
  });
  await card.getByRole("button", { name: "Options", exact: true }).click();
  await expect(card).toContainText("Notes survive closing the panel");
  const other = await context.newPage();
  await open(other, "projects");
  await expect(
    other.getByRole("heading", {
      name: "Original-style private card",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(
    other.getByRole("heading", {
      name: "Original-style private card",
      exact: true,
    }),
  ).toHaveCount(0);
  await other.close();
  await page
    .locator(".preview-main-tabs")
    .getByRole("button", { name: "Preview settings", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Save checkpoint", exact: true })
    .click();
  await page
    .getByLabel("Preview palette", { exact: true })
    .selectOption("olive");
  await expect(page.locator(".admin-preview")).toHaveAttribute(
    "data-preview-theme",
    "olive",
  );
  expect(
    await page.evaluate(() => document.documentElement.dataset.theme),
  ).toBe("original");
  await page
    .getByRole("button", { name: "Restore checkpoint", exact: true })
    .click();
  await expect(page.locator(".admin-preview")).toHaveAttribute(
    "data-preview-theme",
    "original",
  );
  await page
    .getByRole("button", { name: "Plan and backup tools", exact: true })
    .click();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download JSON backup", exact: true })
    .click();
  expect((await download).suggestedFilename()).toBe("wilo-preview-backup.json");
  await page
    .getByRole("link", { name: "Back to administration", exact: true })
    .click();
  await expect(page.locator(".admin-preview")).toHaveCount(0);
  await expect.poll(() => count(request, user.uid)).toBe(before);
});
test("course selection, linked notes, task context, semester archive, local reminders and calendar work", async ({
  page,
  request,
}) => {
  await signIn(page, request);
  await open(page);
  const nav = page.locator(".study-course-browser");
  await nav.getByRole("button").filter({ hasText: "Algorithms" }).click();
  await expect(page.locator(".study-current-course")).toBeVisible();
  await page
    .locator(".preview-tabs")
    .getByRole("button", { name: "Notes and materials", exact: true })
    .click();
  await expect(
    page.locator('.preview-materials a[href="https://ocw.mit.edu/"]').first(),
  ).toBeVisible();
  await page
    .locator(".preview-tabs")
    .getByRole("button", { name: "Study plan", exact: true })
    .click();
  const topic = page.locator(".study-topic-list input").nth(1);
  await topic.click();
  await expect(
    page.getByRole("status").filter({ hasText: "Saved in the preview only" }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator(".study-topic-list input").nth(1)).toBeChecked();
  await page
    .locator(".preview-tabs")
    .getByRole("button", { name: "Tasks", exact: true })
    .click();
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  const form = page.locator(".preview-dialog");
  await form.getByLabel("Name", { exact: true }).fill("Contextual assignment");
  await expect(form.getByLabel("Course", { exact: true })).toHaveValue(
    "course-0",
  );
  await form
    .getByLabel("Date and time", { exact: true })
    .fill("2099-11-10T16:30");
  await form.getByRole("button", { name: "Save", exact: true }).click();
  const task = page
    .locator(".preview-task")
    .filter({ hasText: "Contextual assignment" });
  await expect(task).toContainText("Algorithms");
  await task
    .getByRole("button", {
      name: "Preview reminder Contextual assignment",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "no phone notification" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).last().click();
  await expect(page.locator(".preview-toast")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Plan and backup tools", exact: true })
    .click();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download ICS calendar", exact: true })
    .click();
  expect((await download).suggestedFilename()).toBe("wilo-preview.ics");
  await page
    .locator(".preview-add-menu")
    .getByRole("button", { name: "Add", exact: true })
    .click();
  await page.getByRole("button", { name: "Semester", exact: true }).click();
  await form.getByLabel("Name", { exact: true }).fill("Archived semester");
  await form.getByLabel("Start", { exact: true }).fill("2026-01-01");
  await form.getByLabel("End", { exact: true }).fill("2026-06-01");
  await form.getByRole("button", { name: "Save", exact: true }).click();
  await page
    .locator(".preview-semester select")
    .selectOption({ label: "Archived semester" });
  await page
    .locator(".preview-semester")
    .getByRole("button", { name: "Archive", exact: true })
    .click();
  await expect(
    page.locator(".preview-semester select option:checked"),
  ).toContainText("Archive");
});
test("original interface refinements are responsive, accessible and keep secondary controls collapsed", async ({
  page,
  request,
}) => {
  await signIn(page, request, undefined, "ar");
  await open(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".admin-preview")).toHaveAttribute(
    "data-reduced",
    "true",
  );
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const screen of ["university", "projects", "settings"]) {
      await open(page, screen);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `test-results/interface-preview/ar-${screen}-${width}.png`,
        fullPage: true,
      });
    }
  }
  await open(page);
  await page.setViewportSize({ width: 390, height: 900 });
  await page
    .locator(".study-course-browser button")
    .filter({ hasText: "الخوارزميات" })
    .click();
  await page
    .locator(".preview-tabs")
    .getByRole("button", { name: "الجدول", exact: true })
    .click();
  await expect(page.locator(".preview-day")).toBeVisible();
  await page.keyboard.press("Control+k");
  await expect(page.locator(".preview-dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".preview-dialog")).toHaveCount(0);
  const audit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(audit.violations).toEqual([]);
  for (const language of ["en", "he"]) {
    await page.evaluate((language) => {
      const key = Object.keys(localStorage).find(
        (key) =>
          key.startsWith("wilo-interface-preview-v1/") &&
          !key.includes("/chats"),
      )!;
      const journal = JSON.parse(localStorage.getItem(key)!);
      journal.current.settings.language = language;
      localStorage.setItem(key, JSON.stringify(journal));
    }, language);
    await page.reload();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});
test("assistant follows the real adapter, preserves chats and applies a compound request only in the preview", async ({
  page,
  request,
}) => {
  const user = await signIn(page, request),
    before = await count(request, user.uid);
  await page.evaluate(
    (uid) =>
      sessionStorage.setItem(
        "wilo-pollinations:" + uid,
        "preview-test-only-token",
      ),
    user.uid,
  );
  let mode = "greeting";
  await page.route("https://gen.pollinations.ai/**", async (route) => {
    const payload = route.request().postDataJSON(),
      tool = (name: string, args: unknown, id: string) => ({
        id,
        type: "function",
        function: { name, arguments: JSON.stringify(args) },
      });
    if (mode === "greeting") {
      await route.fulfill({
        json: {
          choices: [
            { message: { content: "Hello from the original-style preview" } },
          ],
        },
      });
      return;
    }
    if (mode === "slow") {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      try {
        await route.fulfill({
          json: {
            choices: [{ message: { content: "LATE_PREVIEW_MUST_NOT_RENDER" } }],
          },
        });
      } catch {
        /* aborted */
      }
      return;
    }
    if (
      payload.tools.some(
        (entry: { function: { name: string } }) =>
          entry.function.name === "request_workspace",
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
    await route.fulfill({
      json: {
        choices: [
          {
            message: {
              tool_calls: [
                tool(
                  "create_card",
                  {
                    alias: "new-card",
                    name: "Assistant private card",
                    nextStep: "Test it",
                  },
                  "card",
                ),
                tool("set_appearance", { theme: "olive" }, "palette"),
              ],
            },
          },
        ],
      },
    });
  });
  await open(page, "projects");
  await page
    .getByRole("button", { name: "WILO assistant", exact: true })
    .click();
  const assistant = page.locator(".preview-assistant");
  await assistant.getByLabel("Your message", { exact: true }).fill("Hello");
  await assistant.getByRole("button", { name: "Send", exact: true }).click();
  await expect(assistant).toContainText(
    "Hello from the original-style preview",
  );
  await assistant.getByRole("button", { name: "Close", exact: true }).click();
  await page.reload();
  await page
    .getByRole("button", { name: "WILO assistant", exact: true })
    .click();
  await expect(assistant).toContainText(
    "Hello from the original-style preview",
  );
  mode = "actions";
  await assistant
    .getByLabel("Your message", { exact: true })
    .fill(
      "Create a card named Assistant private card with next step Test it and change the theme to olive.",
    );
  await assistant.getByRole("button", { name: "Send", exact: true }).click();
  await expect(
    assistant.getByRole("button", { name: "Apply in preview", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Assistant private card", exact: true }),
  ).toHaveCount(0);
  await assistant
    .getByRole("button", { name: "Apply in preview", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Assistant private card", exact: true }),
  ).toBeVisible();
  await expect(assistant).toContainText("Applied in preview only");
  await page.screenshot({
    path: "test-results/interface-preview/assistant-desktop.png",
    fullPage: true,
  });
  await expect.poll(() => count(request, user.uid)).toBe(before);
  expect(
    await page.evaluate(() => document.documentElement.dataset.theme),
  ).toBe("original");
  mode = "slow";
  await assistant
    .getByLabel("Your message", { exact: true })
    .fill("Hello again");
  await assistant.getByRole("button", { name: "Send", exact: true }).click();
  await assistant.getByRole("button", { name: "Stop", exact: true }).click();
  await expect(assistant).toContainText("Stopped. No changes were saved.");
  await page.waitForTimeout(1700);
  await expect(assistant).not.toContainText("LATE_PREVIEW_MUST_NOT_RENDER");
});
test("non-admin cannot load preview, and corrupt private data has a recoverable exit", async ({
  page,
  request,
}) => {
  await signIn(page, request, "preview-nonadmin@example.test");
  const privateRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/assets/preview-"))
      privateRequests.push(request.url());
  });
  await page.goto("/#/admin/preview");
  await expect(page.locator(".admin-preview")).toHaveCount(0);
  expect(privateRequests).toEqual([]);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
  await signIn(page, request);
  await open(page);
  const key = await page.evaluate(
    () =>
      Object.keys(localStorage).find(
        (key) =>
          key.startsWith("wilo-interface-preview-v1/") &&
          !key.includes("/chats"),
      )!,
  );
  await page.evaluate((key) => localStorage.setItem(key, "{broken"), key);
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "Could not read the saved preview",
      exact: true,
    }),
  ).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Reset demo data", exact: true })
    .click();
  await expect(page.locator(".preview-university")).toBeVisible();
  expect(
    await page.evaluate((key) => localStorage.getItem(key + "/recovery"), key),
  ).toBe("{broken");
});

test("account copy and validated import stay private after editing actual copied records", async ({
  page,
  request,
}) => {
  const user = await signIn(page, request),
    base =
      "http://127.0.0.1:8080/v1/projects/demo-where-i-left-off/databases/(default)/documents/users/" +
      user.uid;
  const original = {
    name: "Account sentinel",
    nextStep: "Keep public data intact",
    status: "active",
    rank: 100,
    revision: 0,
    updatedAt: new Date().toISOString(),
  };
  const fields = {
    name: { stringValue: original.name },
    nextStep: { stringValue: original.nextStep },
    status: { stringValue: original.status },
    rank: { doubleValue: original.rank },
    revision: { integerValue: "0" },
    updatedAt: { timestampValue: original.updatedAt },
  };
  expect(
    (
      await request.patch(base + "/projects/preview-live-sentinel", {
        headers: { Authorization: "Bearer owner" },
        data: { fields },
      })
    ).ok(),
  ).toBe(true);
  await open(page, "projects");
  await page
    .getByRole("button", { name: "Plan and backup tools", exact: true })
    .click();
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", {
      name: "Copy my account for this experiment",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", { name: original.name, exact: true }),
  ).toBeVisible();
  const card = page.locator(".preview-project").filter({
    has: page.getByRole("heading", { name: original.name, exact: true }),
  });
  await card.getByRole("button", { name: "Options", exact: true }).click();
  await card.getByRole("button", { name: "Edit", exact: true }).click();
  const form = page.locator(".preview-dialog");
  await form.getByLabel("Name", { exact: true }).fill("Private copy edited");
  await form.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Private copy edited", exact: true }),
  ).toBeVisible();
  const snapshot = await page.evaluate(() => {
    const key = Object.keys(localStorage).find(
      (key) =>
        key.startsWith("wilo-interface-preview-v1/") && !key.includes("/chats"),
    )!;
    return JSON.parse(localStorage.getItem(key)!).current;
  });
  snapshot.data.scopes
    .find((scope: { id: string }) => scope.id === "personal")
    .projects.find(
      (project: { id: string }) => project.id === "preview-live-sentinel",
    ).name = "Imported private edit";
  await page.getByLabel("Import into preview", { exact: true }).setInputFiles({
    name: "private-backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(snapshot)),
  });
  await expect(
    page.getByRole("heading", { name: "Imported private edit", exact: true }),
  ).toBeVisible();
  const live = await request.get(base + "/projects/preview-live-sentinel", {
    headers: { Authorization: "Bearer owner" },
  });
  expect((await live.json()).fields.name.stringValue).toBe(original.name);
  await page
    .getByRole("link", { name: "Back to administration", exact: true })
    .click();
  await expect(page.locator(".admin-preview")).toHaveCount(0);
});

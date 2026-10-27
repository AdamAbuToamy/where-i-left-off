import { test, expect } from "@playwright/test";
import type { Page, APIRequestContext } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { prepareUniversityPilot } from "./universityFixture";
async function signIn(page: Page, request: APIRequestContext, email?: string) {
  const user = await prepareUniversityPilot(request, email);
  await page.addInitScript(
    () =>
      !localStorage.getItem("language") &&
      localStorage.setItem("language", "en"),
  );
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
  await page.locator(".language-trigger").click();
  await page.getByRole("button", { name: "العربية", exact: true }).click();
  return user;
}
function plan() {
  const day = new Date().getDay();
  return {
    version: 1,
    courses: [
      {
        id: "trial-algebra",
        name: "جبر التجربة",
        notes: "مواد الكورس https://example.test/algebra",
        url: "https://example.test/course",
        requires: [],
        topics: [{ id: "trial-topic", title: "موضوع التجربة", done: false }],
        x: 40,
        y: 40,
      },
      {
        id: "trial-algorithms",
        name: "خوارزميات التجربة",
        notes: "",
        url: "",
        requires: ["trial-algebra"],
        topics: [],
        x: 330,
        y: 210,
      },
    ],
    tasks: [
      {
        id: "trial-late",
        courseId: "trial-algebra",
        title: "تسليم التجربة المتأخر",
        kind: "assignment",
        due: "2026-01-01T12:00:00Z",
        done: false,
        notes: "ملاحظة مع رابط https://example.test/task",
        url: "",
      },
      {
        id: "trial-exam",
        courseId: "trial-algebra",
        title: "امتحان التجربة",
        kind: "exam",
        due: "2099-11-01T12:00:00Z",
        done: false,
        notes: "",
        url: "",
      },
    ],
    lessons: [
      {
        id: "trial-lesson",
        courseId: "trial-algebra",
        day,
        start: "09:00",
        end: "10:00",
        room: "قاعة التجربة",
        sessionType: "lecture",
        notes: "https://example.test/class",
      },
    ],
  };
}
async function seed(page: Page) {
  await page.goto("/#/university");
  await expect(page.locator(".study-university-trial")).toBeVisible();
  await page.locator(".study-trial-tools summary").click();
  await page.locator(".study-upload input").setInputFiles({
    name: "trial-plan.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(plan())),
  });
  await page
    .getByRole("button", { name: "تأكيد الإضافة", exact: true })
    .click();
  await expect(page.locator(".study-course-browser")).toContainText(
    "جبر التجربة",
  );
}
test("university default view keeps the original menu, assistant, personal cards and UML", async ({
  page,
  request,
}) => {
  const user = await signIn(page, request);
  await seed(page);
  await expect(page.locator(".side-navigation-toggle")).toBeVisible();
  await page.locator(".side-navigation-toggle").focus();
  await page.locator(".side-navigation-toggle").press("ArrowDown");
  await expect(page.locator(".page-navigation")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.locator(".assistant-launcher").click();
  await expect(page.locator(".assistant-panel")).toBeVisible();
  await expect(page.locator(".assistant-preferences>summary")).toBeVisible();
  await expect(page.locator(".assistant-model-options")).toHaveCount(1);
  await page.locator(".assistant-close").click();
  await page.getByRole("button", { name: /خريطة الكورسات/ }).click();
  await expect(page.locator(".study-map")).toBeVisible();
  await expect(
    page.locator(".study-node").filter({ hasText: "جبر التجربة" }),
  ).toBeVisible();
  await expect(page.locator(".study-map svg path[marker-end]")).toHaveCount(1);
  await page.screenshot({
    path: "test-results/university-only/uml-desktop.png",
    fullPage: true,
  });
  const response = await request.patch(
    "http://127.0.0.1:8080/v1/projects/demo-where-i-left-off/databases/(default)/documents/users/" +
      user.uid +
      "/projects/university-shell-sentinel",
    {
      headers: { Authorization: "Bearer owner" },
      data: {
        fields: {
          name: { stringValue: "Original cards remain" },
          nextStep: { stringValue: "Original next step" },
          status: { stringValue: "active" },
          rank: { doubleValue: 0 },
          revision: { integerValue: "0" },
          updatedAt: { timestampValue: new Date().toISOString() },
        },
      },
    },
  );
  expect(response.ok()).toBe(true);
  await page.goto("/#/personal");
  const card = page.locator(".project-card").filter({
    has: page.getByRole("heading", {
      name: "Original cards remain",
      exact: true,
    }),
  });
  await expect(card).toBeVisible();
  await expect(card.locator(".card-options summary")).toBeVisible();
  await expect(page.locator(".admin-preview")).toHaveCount(0);
  await expect(page.locator(".study-university-trial")).toHaveCount(0);
  await page.goto("/#/university");
  await expect(page.locator(".study-trial-entry")).toHaveCount(0);
  await expect(page.locator(".study-trial-notice")).toHaveCount(0);
  await expect(page.locator(".study-trial-layout")).toBeVisible();
  await expect(page.locator(".study-task-list")).toContainText(
    "امتحان التجربة",
  );
});
test("course tabs, filtering, linked notes, study progress and mobile day agenda use original university persistence", async ({
  page,
  request,
}) => {
  await signIn(page, request);
  await seed(page);
  await page
    .locator(".study-course-browser button")
    .filter({ hasText: "جبر التجربة" })
    .click();
  await expect(page.locator(".study-current-course")).toHaveCount(1);
  await page
    .locator(".study-trial-tabs")
    .getByRole("button", { name: "الملاحظات والمواد", exact: true })
    .click();
  await expect(
    page.locator('.study-trial-panel a[href="https://example.test/algebra"]'),
  ).toBeVisible();
  await page
    .locator(".study-trial-tabs")
    .getByRole("button", { name: "خطة الدراسة", exact: true })
    .click();
  await page
    .getByRole("checkbox", { name: "موضوع التجربة", exact: true })
    .click();
  await expect(
    page.getByRole("checkbox", { name: "موضوع التجربة", exact: true }),
  ).toBeChecked();
  await expect(page.locator(".study-storage")).toContainText("تمت المزامنة");
  await page.reload();
  await expect(
    page.getByRole("checkbox", { name: "موضوع التجربة", exact: true }),
  ).toBeChecked();
  await page
    .locator(".study-trial-tabs")
    .getByRole("button", { name: "المهام والمواعيد", exact: true })
    .click();
  await page.locator(".study-trial-filters summary").click();
  await page.getByLabel("نوع المهمة", { exact: true }).selectOption("exam");
  await expect(page.locator('[data-study-task="trial-exam"]')).toBeVisible();
  await expect(page.locator('[data-study-task="trial-late"]')).toHaveCount(0);
  await page.getByLabel("نوع المهمة", { exact: true }).selectOption("all");
  await page.getByLabel("حالة المهمة", { exact: true }).selectOption("overdue");
  await expect(page.locator('[data-study-task="trial-late"]')).toBeVisible();
  await expect(page.locator('[data-study-task="trial-exam"]')).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "الجدول الأسبوعي", exact: true })
    .first()
    .click();
  await expect(page.locator(".study-trial-day")).toBeVisible();
  await expect(page.locator(".study-trial-lesson")).toContainText(
    "قاعة التجربة",
  );
  await page
    .locator(".study-trial-schedule")
    .getByRole("button", { name: "الجدول الأسبوعي", exact: true })
    .click();
  await expect(page.locator(".study-timetable-scroll")).toBeVisible();
  await page.getByRole("button", { name: /خريطة الكورسات/ }).click();
  await expect(page.locator(".study-map")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/university-only/uml-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "الكورسات والمهام", exact: true })
    .click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.screenshot({
    path: "test-results/university-only/overview-mobile.png",
    fullPage: true,
  });
  const axe = await new AxeBuilder({ page })
    .include(".study-university-trial")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(axe.violations).toEqual([]);
});
test("a regular verified account gets the new default view and old preview links remain compatible", async ({
  page,
  request,
}) => {
  await signIn(page, request, "university-trial-nonadmin@example.test");
  await page.goto("/#/university?preview=1");
  await expect(page.locator(".study-page")).toBeVisible();
  await expect(page.locator(".study-university-trial")).toBeVisible();
  await expect(page.locator(".study-trial-layout")).toBeVisible();
  await expect(page.locator(".study-trial-notice")).toHaveCount(0);
  await expect(page.locator(".study-trial-entry")).toHaveCount(0);
  await expect(page.locator(".side-navigation-toggle")).toBeVisible();
  await page.locator(".assistant-launcher").click();
  await expect(page.locator(".assistant-preferences>summary")).toBeVisible();
});

import { test, expect } from "@playwright/test";
import { prepareUniversityPilot } from "./universityFixture";
for (const phone of [false, true])
  test(`university dashboard priorities and existing editors — ${phone ? "phone" : "desktop"}`, async ({
    page,
    request,
  }) => {
    await page.setViewportSize(
      phone ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
    );
    const c = await prepareUniversityPilot(request);
    await page.addInitScript((uid) => {
      localStorage.setItem("language", "ar");
      localStorage.setItem("welcome-tour:v2:" + uid, "done");
      localStorage.setItem(
        "wilo-experience:v1:" + uid,
        JSON.stringify({ motion: false, sound: false }),
      );
    }, c.uid);
    await page.goto("/");
    await page.locator("input[type=email]").fill(c.email);
    await page.locator("input[type=password]").fill(c.password);
    await page
      .locator("form")
      .getByRole("button", { name: "تسجيل الدخول", exact: true })
      .click();
    await expect(page.locator('[data-tour="add-project"]')).toBeVisible({
      timeout: 15000,
    });
    await page.goto("/#/university");
    await expect(page.locator(".uni-course-empty")).toBeVisible();
    await page.locator(".uni-tools>summary").click();
    const courses = [
      {
        id: "dash-course",
        name: "هندسة البرمجيات",
        notes: "",
        url: "",
        requires: [],
        topics: [],
        x: 0,
        y: 0,
      },
    ];
    const tasks = [1, 2, 3, 4].map((i) => ({
      id: "dash-task-" + i,
      courseId: "dash-course",
      title: "المهمة " + i,
      kind: "assignment",
      due: new Date(Date.now() + i * 86400000).toISOString(),
      done: false,
      notes: "",
      url: "",
    }));
    const lessons = [
      {
        id: "dash-lesson",
        courseId: "dash-course",
        day: new Date().getDay(),
        start: "23:00",
        end: "23:50",
        room: "204",
        notes: "",
        sessionType: "lecture",
      },
    ];
    await page
      .locator(".uni-tools input")
      .setInputFiles({
        name: "dashboard.json",
        mimeType: "application/json",
        buffer: Buffer.from(
          JSON.stringify({ version: 1, courses, tasks, lessons }),
        ),
      });
    await page
      .getByRole("button", { name: "تأكيد الإضافة", exact: true })
      .click();
    await expect(page.locator(".uni-course-card")).toHaveCount(1);
    await expect(page.locator(".uni-deadline")).toHaveCount(3);
    await expect(page.locator(".uni-next-lesson h4")).toContainText("هندسة");
    await expect(page.locator(".study-hero")).toBeHidden();
    await expect(page.locator(".study-controls>.study-tabs")).toBeHidden();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(page.locator(".study-controls")).toBeEnabled({timeout:15000});
    await page.screenshot({
      path: `.wrangler/university-dashboard-${phone ? "phone" : "desktop"}.png`,
      fullPage: true,
    });
    await page.locator(".uni-deadline").first().click();
    await expect(page.locator(".study-dialog")).toBeVisible();
    await page.locator(".study-dialog header button").click();
    await page.locator(".uni-course-card").click();
    await expect(page.locator(".study-trial-panel")).toBeVisible();
    await expect(page.locator(".study-trial-next")).toHaveCount(0);
    await expect(page.locator(".study-workspace-search input")).toBeVisible();
    await page.locator(".study-workspace-search input").fill("هندسة");
    await expect(page.locator(".study-controls")).toBeEnabled({timeout:15000});
    await page.screenshot({animations:"disabled",path: `.wrangler/course-workspace-${phone ? "phone" : "desktop"}.png`,fullPage:true});
    await page.locator(".uni-navigation button").first().click();
    await expect(page.locator(".uni-dashboard-focus")).toBeVisible();
    await page.locator(".uni-navigation button").nth(1).click();
    await expect(page).toHaveURL(/tab=schedule/);
    await expect(page.locator(".uni-dashboard-focus")).toHaveCount(0);
  });

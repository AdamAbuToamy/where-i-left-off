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
    const c = await prepareUniversityPilot(request,"public-dashboard@example.test");
    // Each viewport starts with its own empty emulator plan, even after prior sync completes.
    const records=await request.get(`http://127.0.0.1:8080/v1/projects/demo-where-i-left-off/databases/(default)/documents/users/${c.uid}/studyRecords`,{headers:{Authorization:'Bearer owner'}});
    for(const doc of (await records.json()).documents||[]) await request.delete(`http://127.0.0.1:8080/v1/${doc.name}`,{headers:{Authorization:'Bearer owner'}});
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
    if(phone){
      await expect(page.locator('.uni-kicker')).toBeHidden();
      const spacing=await page.locator('.uni-dashboard-header').evaluate(el=>{const title=el.querySelector('h2')!.getBoundingClientRect();const actions=el.querySelector('.uni-header-actions')!.getBoundingClientRect();return actions.top-title.bottom;});
      expect(spacing).toBeGreaterThanOrEqual(18);
      const header=await page.locator('.page-header').evaluate(el=>{const brand=el.querySelector('.heading-copy')!.getBoundingClientRect();const bell=el.querySelector('.header-account-actions')!.getBoundingClientRect();return {gap:bell.left-brand.right,left:brand.left,right:bell.left};});
      expect(header.gap).toBeGreaterThanOrEqual(20);expect(header.left).toBeLessThan(header.right);
    }
    await expect(page.locator(".uni-course-empty")).toBeVisible();
    await page.locator(".uni-tools>summary").click();
    const courses = [
      {
        id: "dash-course",
        name: "High-Performance Systems Programming S1",
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
    await expect(page.locator(".uni-next-lesson h4")).toContainText("Systems");
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
    await expect(page.locator(".course-overview-cards>button")).toHaveCount(4);
    await expect(page.locator(".study-trial-summary")).toHaveCount(0);
    await page.locator(".course-overview-cards>button").nth(1).click();
    await expect(page.locator(".study-trial-summary")).toBeVisible();
    await page.locator(".study-trial-tabs button").first().click();
    await expect(page.locator(".study-workspace-search input")).toBeVisible();
    if(phone){
      await expect(page.locator('.uni-dashboard-header>div').first()).toBeHidden();
      const tops=await page.locator('.uni-header-actions').evaluate(el=>[...el.children].map(child=>Math.round(child.getBoundingClientRect().top)));
      expect(new Set(tops).size).toBe(1);
      const tabs=page.locator('.study-course-workspace>.study-trial-tabs');
      expect(await tabs.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
      expect(parseFloat(await page.locator('.study-trial-course-heading h3').evaluate(el=>getComputedStyle(el).fontSize))).toBeLessThanOrEqual(20);
    }
    await page.locator(".study-workspace-search input").fill("Systems");
    await expect(page.locator(".study-controls")).toBeEnabled({timeout:15000});
    await page.screenshot({animations:"disabled",path: `.wrangler/course-workspace-${phone ? "phone" : "desktop"}.png`,fullPage:true});
    await page.locator(".uni-navigation button").first().click();
    await expect(page.locator(".uni-dashboard-focus")).toBeVisible();
    await page.locator(".uni-navigation button").nth(1).click();
    await expect(page).toHaveURL(/tab=schedule/);
    await expect(page.locator(".uni-dashboard-focus")).toHaveCount(0);
  });

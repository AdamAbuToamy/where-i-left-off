import { test, expect } from "@playwright/test";
import { prepareUniversityPilot } from "./universityFixture";

for (const mobile of [false, true])
  test.describe(mobile ? "Arabic touch phone" : "Desktop keyboard", () => {
    test.use({
      viewport: mobile
        ? { width: 390, height: 844 }
        : { width: 1440, height: 1000 },
      isMobile: mobile,
      hasTouch: mobile,
    });
    test("pinboard keeps genuine section strings and reorders cards", async ({
      page,
      request,
    }) => {
      await page.setViewportSize(
        mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
      );
      const { email, password, uid } = await prepareUniversityPilot(request);
      const language = mobile ? "ar" : "en";
      const text = mobile
        ? {
            tools: "أدوات العرض",
            manage: "تنظيم الأقسام",
            addSection: "إضافة قسم",
            all: "كل الأقسام",
            newCard: "بطاقة جديدة",
            save: "حفظ البطاقة",
            threads: "خيوط الأقسام",
          }
        : {
            tools: "View tools",
            manage: "Manage sections",
            addSection: "Add section",
            all: "All sections",
            newCard: "New card",
            save: "Save card",
            threads: "Section threads",
          };
      await page.addInitScript(
        ({ language, uid }) => {
          localStorage.setItem("language", language);
          localStorage.setItem("welcome-tour:v2:" + uid, "done");
        },
        { language, uid },
      );
      await page.goto("/");
      await page.locator('input[type="email"]').fill(email);
      await page.locator('input[type="password"]').fill(password);
      await page
        .locator("form")
        .getByRole("button", {
          name: mobile ? "تسجيل الدخول" : "Sign in",
          exact: true,
        })
        .click();
      await expect(page.locator("html")).toHaveAttribute(
        "data-kitchen-study",
        "on",
        { timeout: 15000 },
      );
      await page.goto("/#/personal");
      const sectionName = mobile ? "مختبر الهاتف" : "Design lab";
      const openSections = async () => {
        if (!(await page.locator(".sections-disclosure-trigger").isVisible()))
          await page
            .getByRole("button", { name: text.tools, exact: true })
            .click();
        if (
          !(await page
            .locator(".sections-disclosure")
            .evaluate((el) => (el as HTMLDetailsElement).open))
        )
          await page.locator(".sections-disclosure-trigger").click();
      };
      await openSections();
      await page
        .getByRole("button", { name: text.manage, exact: true })
        .click();
      await page.locator("#section-name").fill(sectionName);
      await page
        .getByRole("button", { name: text.addSection, exact: true })
        .click();
      await page
        .locator(".section-navigation button")
        .filter({ hasText: sectionName })
        .click();
      const add = async (name: string, overdue = false) => {
        await page
          .getByRole("button", { name: text.newCard, exact: true })
          .click();
        await page.locator("#project-name").fill(name);
        await page
          .locator("#project-next-step")
          .fill(mobile ? "راجع الخطوة القادمة" : "Review the next step");
        if (overdue) await page.locator("#project-due-date").fill("2020-01-01");
        await page
          .getByRole("button", { name: text.save, exact: true })
          .click();
        await expect(
          page.locator(".envelope-summary h2").filter({ hasText: name }),
        ).toBeVisible();
      };
      await add(mobile ? "تجربة الدبابيس" : "Pinboard first", true);
      await add(mobile ? "تجربة الخيوط" : "Pinboard second");
      await openSections();
      await page.getByRole("button", { name: text.all, exact: true }).click();
      await add(mobile ? "بطاقة مستقلة" : "Unassigned note");
      await openSections();
      await page.getByRole("button", { name: text.all, exact: true }).click();
      await page
        .getByRole("button", { name: text.tools, exact: true })
        .press("Escape");
      await page
        .getByRole("button", { name: text.threads, exact: true })
        .click();

      const grouped = page
        .locator("[data-board-section]")
        .filter({
          has: page
            .locator(".envelope-section")
            .filter({ hasText: sectionName }),
        });
      await expect(grouped).toHaveCount(2);
      const sectionId = await grouped
        .first()
        .getAttribute("data-board-section");
      const groupThreads = page.locator(
        `.pinboard-threads > path[data-thread-section="${sectionId}"]`,
      );
      await expect(groupThreads).toHaveCount(1);
      await page.screenshot({
        path: `.wrangler/pinboard-${mobile ? "ar-phone" : "desktop"}.png`,
        fullPage: true,
        animations: "disabled",
      });
      const before = await grouped.evaluateAll((nodes) =>
        nodes.map((node) => (node as HTMLElement).dataset.boardId),
      );
      const handle = grouped.first().locator(".drag-handle");
      if (mobile) {
        await grouped.first().scrollIntoViewIfNeeded();
        const grip = await handle.boundingBox(),
          first = await grouped.first().boundingBox(),
          last = await grouped.last().boundingBox();
        if (!grip || !first || !last)
          throw new Error("Missing visible drag coordinates");
        const client = await page.context().newCDPSession(page),
          x = grip.x + grip.width / 2,
          y = grip.y + grip.height / 2;
        await client.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [{ x, y }],
        });
        // TouchSensor intentionally requires a 220ms long press before starting a drag.
        await page.waitForTimeout(280);
        await expect(page.locator(".sortable-project.is-dragging")).toHaveCount(
          1,
        );
        await expect(page.locator(".pinboard-threads")).toHaveCount(0);
        for (let step = 1; step <= 6; step++) {
          await client.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ x, y: y + ((last.y - first.y) * step) / 6 }],
          });
          await page.waitForTimeout(35);
        }
        await client.send("Input.dispatchTouchEvent", {
          type: "touchEnd",
          touchPoints: [],
        });
        await client.detach();
      } else {
        await handle.focus();
        await handle.press("Space");
        await expect(page.locator(".pinboard-threads")).toHaveCount(0);
        const original = await page
          .locator(".is-dragging")
          .evaluate((el) => getComputedStyle(el).transform);
        await handle.press("ArrowRight");
        await expect
          .poll(() =>
            page
              .locator(".is-dragging")
              .evaluate((el) => getComputedStyle(el).transform),
          )
          .not.toBe(original);
        await handle.press("Space");
      }
      await expect
        .poll(() =>
          grouped.evaluateAll((nodes) =>
            nodes.map((node) => (node as HTMLElement).dataset.boardId),
          ),
        )
        .not.toEqual(before);

      await expect(groupThreads).toHaveCount(1);
      await expect(page.locator(".rough-annotation").first()).toBeAttached();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `.wrangler/pinboard-${mobile ? "ar-phone" : "desktop"}.png`,
        fullPage: true,
        animations: "disabled",
      });
    });
  });

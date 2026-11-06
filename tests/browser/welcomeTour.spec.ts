import { test, expect } from "@playwright/test";
import { prepareUniversityPilot } from "./universityFixture";
import { tourText } from "../../src/tourText";
for (const phone of [false, true])
  test.describe(phone ? "Arabic phone tour" : "English desktop tour", () => {
    test.use({
      viewport: phone
        ? { width: 390, height: 844 }
        : { width: 1440, height: 1000 },
      isMobile: phone,
      hasTouch: phone,
    });
    test("spotlights the actual pages, explains all areas and never creates data or calls the model", async ({
      page,
      request,
    }) => {
      test.setTimeout(180000);
      const language = phone ? "ar" : "en",
        t = tourText[language];
      const c = await prepareUniversityPilot(
        request,
        `tour-${phone}@example.test`,
      );
      await request.patch(
        `http://127.0.0.1:8080/v1/projects/demo-where-i-left-off/databases/(default)/documents/users/${c.uid}/projects/tour000000000001`,
        {
          headers: { Authorization: "Bearer owner" },
          data: {
            fields: {
              name: { stringValue: "Tour card" },
              nextStep: { stringValue: "Continue from here" },
              status: { stringValue: "later" },
              rank: { integerValue: "0" },
              revision: { integerValue: "0" },
              mutationId: { stringValue: "fixture" },
            },
          },
        },
      );
      await page.addInitScript(
        ({ uid, language }) => {
          localStorage.setItem("language", language);
          localStorage.setItem("welcome-tour:v2:" + uid, "done");
        },
        { uid: c.uid, language },
      );
      await page.goto("/");
      await page.locator('input[type="email"]').fill(c.email);
      await page.locator('input[type="password"]').fill(c.password);
      await page
        .locator("form")
        .getByRole("button", {
          name: phone ? "تسجيل الدخول" : "Sign in",
          exact: true,
        })
        .click();
      await expect(page.locator(".workspace-toolbar")).toBeVisible({
        timeout: 15000,
      });
      await page.goto("/#/settings");
      const replayGroup = page
        .locator(".settings-group")
        .filter({ has: page.locator(".tour-replay") });
      await replayGroup.locator(":scope > summary").click();
      await page.locator(".tour-replay").click();
      const guide = page.locator(".tour-popover"),
        steps = t.steps.filter(
          (s) => !s.adminOnly && (!s.desktopOnly || !phone),
        );
      let calls = 0;
      page.on("request", (r) => {
        if (
          r.url().includes("chat/completions") ||
          (r.url().includes("assistant-account") &&
            r.postData()?.includes('"action":"completion"'))
        )
          calls++;
      });
      const pages = new Set<string>();
      for (const [index, step] of steps.entries()) {
        await expect(guide).toHaveAttribute("data-tour-step", step.id);
        await expect
          .poll(() => page.evaluate(() => location.hash))
          .toBe("#" + step.hash);
        await expect(
          guide.getByRole("heading", { name: step.title, exact: true }),
        ).toBeVisible();
        await expect(page.locator(".tour-focus")).toBeVisible({
          timeout: 15000,
        });
        await expect(page.locator("#root")).toHaveAttribute("inert", "");
        pages.add(step.hash.split("?")[0]);
        await expect
          .poll(async () => {
            const box = await guide.boundingBox();
            return (
              !!box &&
              box.x >= 10 &&
              box.y >= 10 &&
              box.x + box.width <= (phone ? 390 : 1440) - 10 &&
              box.y + box.height <= (phone ? 844 : 1000) - 10
            );
          })
          .toBe(true);
        if (step.id === "appearance")
          await expect(
            page
              .locator(".settings-group")
              .filter({ has: page.locator(".theme-options") }),
          ).toHaveAttribute("open", "");
        if (step.id === "courses") {
          await guide
            .getByRole("button", { name: t.back, exact: true })
            .click();
          await expect(guide).toHaveAttribute(
            "data-tour-step",
            steps[index - 1].id,
          );
          await guide.locator(".tour-next").click();
          await expect(guide).toHaveAttribute("data-tour-step", step.id);
        }
        if (["create", "timetable", "appearance"].includes(step.id))
          await page.screenshot({
            path: `.wrangler/tour-${language}-${step.id}.png`,
            animations: "disabled",
          });
        await guide.locator(".tour-next").click();
      }
      await expect(guide).toHaveCount(0);
      await expect(page.locator("#root")).not.toHaveAttribute("inert", "");
      expect(
        await page
          .locator(".page-header")
          .evaluate((node) => (node as HTMLElement).style.filter),
      ).toBe("");
      expect(pages.size).toBeGreaterThanOrEqual(7);
      expect(calls).toBe(0);
      const cards = await request.get(
        `http://127.0.0.1:8080/v1/projects/demo-where-i-left-off/databases/(default)/documents/users/${c.uid}/projects`,
        { headers: { Authorization: "Bearer owner" } },
      );
      expect((await cards.json()).documents).toHaveLength(1);
      await page.evaluate(() =>
        window.dispatchEvent(new Event("replay-welcome-tour")),
      );
      await guide.locator(".tour-chapters > summary").click();
      const target = t.steps.find((s) => s.id === "analytics")!;
      await guide
        .getByRole("navigation", { name: t.browse })
        .getByRole("button", { name: new RegExp(target.title) })
        .click();
      await expect(guide).toHaveAttribute("data-tour-step", "analytics");
      await page.keyboard.press("Tab");
      await expect(guide.locator(".guide-skip")).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(guide).toHaveCount(0);
      await expect(page.locator("#root")).not.toHaveAttribute("inert", "");
      expect(
        await page
          .locator(".page-header")
          .evaluate((node) => (node as HTMLElement).style.filter),
      ).toBe("");
      await page.evaluate(()=>window.dispatchEvent(new Event("replay-welcome-tour")));
      await guide.locator(".tour-chapters > summary").click();
      const appearance=t.steps.find(step=>step.id==="appearance")!;
      await guide.getByRole("navigation",{name:t.browse}).getByRole("button",{name:new RegExp(appearance.title)}).click();
      await expect(guide).toHaveAttribute("data-tour-step","appearance");
      await expect(page.locator(".theme-options")).toBeVisible();
      await guide.getByRole("button",{name:t.tryIt,exact:true}).click();
      await expect(guide).toHaveCount(0);
      await expect(page.locator(".theme-options")).toBeVisible();
      await expect(page.locator(".theme-options")).toBeFocused();
    });
  });

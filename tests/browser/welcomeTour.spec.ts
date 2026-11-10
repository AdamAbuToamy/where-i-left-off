import { test, expect } from "@playwright/test";
import { prepareUniversityPilot } from "./universityFixture";
import { journeyText } from "../../src/components/journeyText";
for (const phone of [false, true])
  test(`interactive welcome journey creates a real card and ${phone ? "deletes only its receipt — Arabic phone" : "keeps it — desktop"}`, async ({
    page,
    request,
  }) => {
    test.setTimeout(120000);
    await page.setViewportSize(
      phone ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
    );
    const language = phone ? "ar" : "en",
      t = journeyText[language];
    const account = await prepareUniversityPilot(
      request,
      `journey-${phone}-${Date.now()}@example.test`,
    );
    const documents = `http://127.0.0.1:8080/v1/projects/demo-where-i-left-off/databases/(default)/documents/users/${account.uid}/projects`;
    const legacyId = "legitimate0000000001";
    await request.patch(documents + "/" + legacyId, {
      headers: { Authorization: "Bearer owner" },
      data: {
        fields: {
          name: { stringValue: "Keep my earlier card" },
          nextStep: { stringValue: "Untouched" },
          status: { stringValue: "later" },
          rank: { integerValue: "1000" },
          revision: { integerValue: "0" },
          mutationId: { stringValue: "fixture" },
        },
      },
    });
    await page.addInitScript(
      ({ uid, language }) => {
        localStorage.setItem("language", language);
        localStorage.setItem(
          "wilo-experience:v1:" + uid,
          JSON.stringify({ motion: false, sound: false }),
        );
      },
      { uid: account.uid, language },
    );
    await page.goto("/");
    await page
      .getByLabel(phone ? "البريد الإلكتروني" : "Email", { exact: true })
      .fill(account.email);
    await page.locator(".auth-continue").click();
    await page
      .getByLabel(phone ? "كلمة المرور" : "Password", { exact: true })
      .fill(account.password);
    await page
      .locator("form")
      .getByRole("button", {
        name: phone ? "تسجيل الدخول" : "Sign in",
        exact: true,
      })
      .click();
    const welcome = page.locator(".journey-welcome");
    await expect(welcome).toBeVisible({ timeout: 20000 });
    await expect(
      welcome.getByRole("button", { name: t.skip, exact: true }),
    ).toBeVisible();
    await welcome.getByRole("button", { name: t.start, exact: true }).click();
    const guide = page.locator(".journey-coach");
    await page.evaluate(
      () => (document.documentElement.dataset.cinematic = "on"),
    );
    await expect(guide.locator(".companion-life")).toHaveCSS(
      "animation-iteration-count",
      "infinite",
    );
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(guide.locator(".companion-life")).toHaveCSS(
      "animation-name",
      "none",
    );
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.evaluate(
      () => (document.documentElement.dataset.cinematic = "off"),
    );

    await expect(guide).toBeVisible();
    await expect(page.locator(".journey-layer")).toHaveAttribute(
      "data-tour-step",
      "create",
    );
    // The collapsed form is mounted but inert: it must not steal the guide target.
    await expect(page.locator(".journey-layer")).toHaveAttribute(
      "data-cue",
      "create",
    );
    await expect(page.locator('[data-tour="add-project"]')).toHaveAttribute(
      "data-journey-target",
      "true",
    );
    await page.locator('[data-tour="add-project"]').click();
    await expect(page.locator(".journey-layer")).toHaveAttribute(
      "data-cue",
      "name",
    );
    await expect(guide).toBeVisible();
    expect(await guide.evaluate((node) => !node.closest("[inert]"))).toBe(true);
    await page.screenshot({
      path: `/tmp/wilo-guide-form-${phone ? "phone" : "desktop"}.png`,
      animations: "disabled",
    });
    await page.locator("#project-name").fill("My real journey card");
    await page
      .locator("#project-name")
      .evaluate((node) => (node as HTMLInputElement).blur());
    await expect(page.locator(".journey-layer")).toHaveAttribute(
      "data-cue",
      "save",
    );
    await expect
      .poll(() =>
        page.locator('[data-tour="save-project"]').evaluate((node) => {
          const rect = node.getBoundingClientRect();
          return rect.top >= 0 && rect.bottom <= innerHeight;
        }),
      )
      .toBe(true);

    await guide.getByRole("button", { name: t.hide, exact: true }).click();
    await guide.getByRole("button", { name: t.show, exact: true }).click();
    await expect(page.locator(".journey-layer")).toHaveAttribute(
      "data-tour-step",
      "create",
    );
    await expect(page.locator("#project-name")).toHaveValue(
      "My real journey card",
    );

    await expect(page.locator(".journey-backdrop")).toBeVisible();
    await expect
      .poll(() =>
        page.locator(".page-header").evaluate((node) => {
          let current: Element | null = node;
          while (current) {
            if (getComputedStyle(current).filter === "blur(3px)") return true;
            current = current.parentElement;
          }
          return false;
        }),
      )
      .toBe(true);
    if (phone) {
      await guide
        .getByRole("button", { name: t.addDetails, exact: true })
        .click();
      await page.locator("#project-next-step").fill("Try one small step");
      await page.locator('[data-tour="save-project"]').click();
    } else
      await guide
        .getByRole("button", { name: t.saveName, exact: true })
        .click();
    await expect(page.locator(".journey-layer")).toHaveAttribute(
      "data-tour-step",
      "card",
    );
    const card = page
      .locator(".project-card")
      .filter({ hasText: "My real journey card" });
    await expect(card).toBeVisible();
    const createdId = await card.getAttribute("data-project");
    expect(createdId).toBeTruthy();
    await page.screenshot({
      path: `/tmp/wilo-journey-${phone ? "phone" : "desktop"}.png`,
      animations: "disabled",
    });
    const box = await guide.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(phone ? 390 : 1440);
    if (phone)
      await guide
        .getByRole("button", { name: t.openCard, exact: true })
        .click();
    else {
      await card.locator(".envelope-expand").click();
    }
    const panel = page.locator(".card-detail-panel");
    await expect(panel).toBeVisible();
    await expect(guide).toBeVisible();
    expect(await guide.evaluate((node) => !node.closest("[inert]"))).toBe(true);
    await expect(guide.locator(".journey-companion")).toBeVisible();
    await expect(panel.locator(".card-reminder-trigger")).toHaveAttribute(
      "data-journey-target",
      "true",
    );
    await expect
      .poll(() =>
        page.locator("#root").evaluate((node) => getComputedStyle(node).filter),
      )
      .toBe("blur(3px)");
    expect(
      await guide
        .locator("h2")
        .evaluate((node) => node.getBoundingClientRect().width),
    ).toBeGreaterThan(150);
    await expect(guide.locator(".journey-minimize")).toHaveCSS("width", "32px");

    await page.screenshot({
      path: `/tmp/wilo-guide-expanded-${phone ? "phone" : "desktop"}.png`,
      animations: "disabled",
    });

    if (phone)
      await expect(
        panel.getByText("Try one small step", { exact: true }),
      ).toBeVisible();
    await panel
      .getByRole("button", { name: phone ? "رجوع" : "Back", exact: true })
      .click();
    await guide.getByRole("button", { name: t.tried, exact: true }).click();
    await expect(page).toHaveURL(/#\/university/);
    await expect(page.locator(".study-page")).toBeVisible();
    await expect(page.locator(".study-page")).toHaveAttribute(
      "data-journey-target",
      "true",
    );
    expect(
      await page.locator(".study-page").evaluate((node) => {
        let parent: Element | null = node;
        while (parent) {
          if (getComputedStyle(parent).filter.includes("blur")) return false;
          parent = parent.parentElement;
        }
        return !node.querySelector('[style*="filter: blur"]');
      }),
    ).toBe(true);
    await page.screenshot({
      path: `/tmp/wilo-university-tour-clear-${phone ? "phone" : "desktop"}.png`,
      animations: "disabled",
    });

    await guide.getByRole("button", { name: t.next, exact: true }).click();
    await expect(page).toHaveURL(/#\/groups/);
    await expect(page.locator(".group-spaces")).toBeVisible();
    await guide.getByRole("button", { name: t.next, exact: true }).click();
    await expect(welcome).toBeVisible();
    await expect(
      welcome.getByText("My real journey card", { exact: true }),
    ).toBeVisible();
    if (phone) {
      await expect(
        welcome.getByRole("button", { name: t.remove, exact: true }),
      ).toBeEnabled({ timeout: 15000 });
      await welcome
        .getByRole("button", { name: t.remove, exact: true })
        .click();
    } else
      await welcome.getByRole("button", { name: t.keep, exact: true }).click();
    await expect(welcome).toHaveCount(0, { timeout: 25000 });
    await expect
      .poll(async () => {
        const response = await request.get(documents + "/" + createdId, {
          headers: { Authorization: "Bearer owner" },
        });
        return response.status();
      })
      .toBe(phone ? 404 : 200);
    expect(
      (
        await request.get(documents + "/" + legacyId, {
          headers: { Authorization: "Bearer owner" },
        })
      ).status(),
    ).toBe(200);
    await page.reload();
    await expect(page.locator(".workspace-toolbar")).toBeVisible();
    await expect(page.locator(".journey-welcome")).toHaveCount(0);
    if (!phone)
      await expect(page.locator(`[data-project="${createdId}"]`)).toBeVisible();
  });

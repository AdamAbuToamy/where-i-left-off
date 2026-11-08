import { test, expect } from "@playwright/test";
import { prepareUniversityPilot } from "./universityFixture";
import { mkdir } from "node:fs/promises";
for (const mobile of [false, true])
  test(`compact ${mobile ? "phone RTL" : "desktop"} cards expand and reorder with independent handle`, async ({
    page,
    request,
  }) => {
    await page.setViewportSize(
      mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
    );
    const { email, password } = await prepareUniversityPilot(request);
    await page.addInitScript(() => {
      if (!localStorage.getItem("language"))
        localStorage.setItem("language", "en");
    });
    await page.goto("/");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.locator(".auth-journey .auth-continue").click(); await page.getByLabel("Password", { exact: true }).fill(password);
    await page
      .locator("form")
      .getByRole("button", { name: "Sign in", exact: true })
      .click();
    await expect(page.locator(".side-navigation-toggle")).toBeVisible({
      timeout: 15000,
    });
    const skip = page.locator(".guide-skip");
    if (await skip.isVisible()) await skip.click();
    await page.goto("/#/admin");
    await page.goto("/#/personal");
    const prefix = mobile ? "Envelope phone" : "Envelope desktop";
    for (const name of [prefix + " A", prefix + " B"]) {
      await page.getByRole("button", { name: "New card", exact: true }).click();
      await page.getByLabel("Card title", { exact: true }).fill(name);
      await page
        .getByLabel("Next step", { exact: true })
        .fill("A short preserved next step");
      await page
        .getByRole("button", { name: "Save card", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name, exact: true }),
      ).toBeVisible();
    }
    const card = page.locator(".project-card").filter({
      has: page.getByRole("heading", { name: prefix + " A", exact: true }),
    });
    expect((await card.boundingBox())!.height).toBeLessThan(330);
    expect(
      await card.evaluate((el) => getComputedStyle(el).backdropFilter),
    ).toBe("none");
    const menu = page.locator(".side-navigation-toggle");
    await menu.hover();
    await expect(menu).toHaveAttribute("aria-expanded", "true");
    await menu.click();
    await expect(menu).toHaveAttribute("aria-expanded", "true");
    await menu.press("Escape");
    const tools = page.getByRole("button", { name: "View tools", exact: true });
    await tools.hover();
    await expect(tools).toHaveAttribute("aria-expanded", "true");
    await tools.click();
    const sections = page.locator(".sections-disclosure");
    await sections.locator("summary").hover();
    expect(
      await sections.evaluate((el) => (el as HTMLDetailsElement).open),
    ).toBe(false);
    await sections.locator("summary").click();
    expect(
      await sections.evaluate((el) => (el as HTMLDetailsElement).open),
    ).toBe(true);
    await expect(async () => {
      const box = (await page.locator(".workspace-tools-panel").boundingBox())!;
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height).toBeLessThanOrEqual(
        page.viewportSize()!.height + 1,
      );
    }).toPass({ timeout: 3000 });
    await tools.press("Escape");
    const toolbar = await page.locator(".workspace-search-tools").boundingBox(),
      dockBox = (await tools.boundingBox())!;
    expect(dockBox.y).toBeGreaterThanOrEqual(toolbar!.y);
    expect(dockBox.y + dockBox.height).toBeLessThanOrEqual(
      toolbar!.y + toolbar!.height + 1,
    );
    const title = (await page.locator(".brand-spotlight").boundingBox())!,
      header = (await page.locator(".page-header").boundingBox())!;
    expect(
      Math.abs(title.x + title.width - header.x - header.width),
    ).toBeLessThan(3);
    expect(
      await page
        .locator(".page-header")
        .evaluate((el) => getComputedStyle(el).backgroundColor),
    ).toBe("rgba(0, 0, 0, 0)");
    const handle = page.getByRole("button", {
      name: "Drag to reorder: " + prefix + " A",
      exact: true,
    });
    await expect(handle).toBeVisible();
    const before = await page
      .locator(".project-card")
      .evaluateAll((elements) =>
        elements.map((e) => e.getAttribute("data-project")),
      );
    if (mobile) {
      await handle.focus();
      await page.keyboard.press("Space");
      await expect(page.locator(".is-dragging")).toHaveCount(1);
      await page.keyboard.press("ArrowUp");
      await expect(
        page
          .locator('[role="status"]')
          .filter({ hasText: prefix + " A. Position: 1" }),
      ).toHaveCount(1);
      await page.keyboard.press("Space");
    } else {
      const from = (await handle.boundingBox())!,
        to = (await page.locator(".sortable-project").first().boundingBox())!;
      await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
      await page.mouse.down();
      await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, {
        steps: 15,
      });
      await page.mouse.up();
    }
    await expect(async () => {
      const after = await page
        .locator(".project-card")
        .evaluateAll((elements) =>
          elements.map((e) => e.getAttribute("data-project")),
        );
      expect(after).not.toEqual(before);
    }).toPass({ timeout: 10000 });
    const ordered = await page
      .locator(".project-card")
      .evaluateAll((elements) =>
        elements.map((e) => e.getAttribute("data-project")),
      );
    await page.reload();
    await expect(page.locator(".project-card")).toHaveCount(ordered.length);
    await expect(async () =>
      expect(
        await page
          .locator(".project-card")
          .evaluateAll((elements) =>
            elements.map((e) => e.getAttribute("data-project")),
          ),
      ).toEqual(ordered),
    ).toPass({ timeout: 10000 });
    const target = page.locator(".project-card").filter({
      has: page.getByRole("heading", { name: prefix + " A", exact: true }),
    });
    await target.hover();
    await target
      .getByRole("button", {
        name: "Expand card: " + prefix + " A",
        exact: true,
      })
      .click();
    await expect(target.locator(".envelope-content")).toBeVisible();
    await expect(
      target.getByText("A short preserved next step", { exact: true }),
    ).toBeVisible();
    await expect(
      target.getByRole("button", { name: "Start work", exact: true }),
    ).toBeVisible();
    await target
      .getByRole("button", { name: "Collapse card", exact: true })
      .click();
    if (mobile) {
      await page.evaluate(() => localStorage.setItem("language", "ar"));
      await page.reload();
      await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
      await expect(
        page.getByRole("button", {
          name: "تكبير البطاقة: " + prefix + " A",
          exact: true,
        }),
      ).toBeVisible();
    }
    await expect(page.locator(".workspace-fields").last()).toBeEnabled();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await mkdir(".wrangler", { recursive: true });
    await page.screenshot({
      path: `.wrangler/compact-${mobile ? "phone" : "desktop"}.png`,
      fullPage: true,
    });
  });

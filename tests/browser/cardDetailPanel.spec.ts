import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";
import { prepareUniversityPilot } from "./universityFixture";
for (const dark of [false, true])
  for (const phone of [false, true]) {
    test(`card detail pages preserve notes and editing — ${phone ? "phone" : "desktop"} ${dark ? "dark" : "light"}`, async ({
      page,
      request,
    }) => {
      test.setTimeout(90000);
      await page.setViewportSize(
        phone ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
      );
      const c = await prepareUniversityPilot(request);
      await request.patch(
        `http://127.0.0.1:8080/v1/projects/demo-where-i-left-off/databases/(default)/documents/users/${c.uid}/projects/panel000000000001`,
        {
          headers: { Authorization: "Bearer owner" },
          data: {
            fields: {
              name: { stringValue: "Panel card" },
              nextStep: { stringValue: "Continue the experiment" },
              description: { stringValue: "Saved notes remain intact" },
              checklist: { stringValue: "[ ] Check prototype" },
              projectUrl: { stringValue: "https://example.com" },
              dueDate: { stringValue: "2099-11-18" },
              status: { stringValue: "later" },
              rank: { integerValue: "-10000" },
              revision: { integerValue: "0" },
              mutationId: { stringValue: "fixture" },
            },
          },
        },
      );
      await page.addInitScript(
        ({ uid, dark }) => {
          localStorage.setItem("language", "en");
          localStorage.setItem("site-color-mode", dark ? "dark" : "light");
          localStorage.setItem(
            "site-color-mode:" + uid,
            dark ? "dark" : "light",
          );
          localStorage.setItem("welcome-tour:v2:" + uid, "done");
        },
        { uid: c.uid, dark },
      );
      await page.goto("/");
      await page.getByLabel("Email", { exact: true }).fill(c.email);
      await page.locator(".auth-journey .auth-continue").click();
      await page.getByLabel("Password", { exact: true }).fill(c.password);
      await page
        .locator("form")
        .getByRole("button", { name: "Sign in", exact: true })
        .click();
      const card = page.locator('[data-project="panel000000000001"]');
      if (!phone) await card.hover();
      await card
        .getByRole("button", { name: "Expand card: Panel card", exact: true })
        .click();
      const panel = page.locator(".card-detail-panel");
      await expect(panel).toBeVisible();
      if (!phone)
        await expect
          .poll(() =>
            page.locator(".workspace-command-bar").evaluate((bar) => {
              const box = bar.getBoundingClientRect();
              return Array.from(
                bar.querySelectorAll("button,[role=combobox]"),
              ).filter((el) => {
                const r = el.getBoundingClientRect();
                return (
                  r.width > 0 &&
                  r.height > 0 &&
                  (r.left < box.left - 1 || r.right > box.right + 1)
                );
              }).length;
            }),
          )
          .toBe(0);
      await expect(
        panel.getByText("Continue the experiment", { exact: true }),
      ).toBeVisible();
      await expect(
        panel.getByText("Saved notes remain intact", { exact: true }),
      ).not.toBeVisible();
      await page.screenshot({
        path: `/tmp/wilo-card-overview-${phone ? "phone" : "desktop"}.png`,
        animations: "disabled",
      });
      await expect(
        panel.getByRole("button", { name: "Card reminder", exact: true }),
      ).toBeEnabled();
      const tabs = panel.getByRole("navigation", { name: "Card details" });
      await tabs.getByRole("button", { name: "Notes", exact: true }).click();
      await expect(
        panel.getByText("Saved notes remain intact", { exact: true }),
      ).toBeVisible();
      await expect(
        panel.getByText("Continue the experiment", { exact: true }),
      ).not.toBeVisible();
      await tabs
        .getByRole("button", { name: "Checklist", exact: true })
        .click();
      await expect(panel.getByRole("checkbox")).toBeVisible();
      await tabs
        .getByRole("button", { name: "Links and dates", exact: true })
        .click();
      await expect(
        panel.locator('a[href="https://example.com"]'),
      ).toBeVisible();
      if (dark) {
        const a11y = await new AxeBuilder({ page })
          .include(".card-detail-panel")
          .withRules(["color-contrast"])
          .analyze();
        expect(a11y.violations).toEqual([]);
      }
      const box = (await panel.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(phone ? 391 : 1440);
      if (phone) expect(box.width).toBeGreaterThan(380);
      else {
        expect(box.width).toBeGreaterThan(800);
        await expect
          .poll(() =>
            page
              .locator("#root")
              .evaluate((n) => parseFloat(getComputedStyle(n).paddingLeft)),
          )
          .toBeGreaterThan(800);
      }
      await page.screenshot({
        path: `.wrangler/card-detail-${phone ? "phone" : "desktop"}.png`,
        animations: "disabled",
      });
      await expect(
        panel.getByRole("button", { name: "Edit", exact: true }),
      ).toBeVisible();
      await expect(
        panel.getByRole("button", { name: "Archive card", exact: true }),
      ).toBeVisible();
      await expect(
        panel.getByRole("button", { name: "Delete", exact: true }),
      ).toBeVisible();
      await panel.getByRole("button", { name: "Edit", exact: true }).click();
      await expect(panel.locator(".card-editor-addon")).toHaveCount(4);
      await expect(
        panel.getByLabel("Next step", { exact: true }),
      ).not.toBeVisible();
      await page.screenshot({
        path: `/tmp/wilo-card-editor-${phone ? "phone" : "desktop"}.png`,
        animations: "disabled",
      });
      const nextAddon = panel
        .locator(".card-editor-addon")
        .filter({ hasText: "Next step" });
      await nextAddon.locator("summary").click();
      await expect(panel.getByLabel("Next step", { exact: true })).toHaveValue(
        "Continue the experiment",
      );
      await nextAddon.locator("summary").click();
      if (dark) {
        const editorContrast = await new AxeBuilder({ page })
          .include(".card-detail-panel")
          .withRules(["color-contrast"])
          .analyze();
        expect(editorContrast.violations).toEqual([]);
      }

      await panel
        .getByLabel("Project name", { exact: true })
        .fill("Updated panel card");
      await panel
        .getByRole("button", { name: "Save changes", exact: true })
        .click();
      await expect(panel.locator(".envelope-content h2")).toHaveText(
        "Updated panel card",
      );
      const stored = await request.get(
        `http://127.0.0.1:8080/v1/projects/demo-where-i-left-off/databases/(default)/documents/users/${c.uid}/projects/panel000000000001`,
        { headers: { Authorization: "Bearer owner" } },
      );
      const fields = (await stored.json()).fields;
      for (const [field, value] of Object.entries({
        nextStep: "Continue the experiment",
        description: "Saved notes remain intact",
        checklist: "[ ] Check prototype",
        projectUrl: "https://example.com",
        dueDate: "2099-11-18",
      }))
        expect(fields[field].stringValue).toBe(value);
      await panel.getByRole("button", { name: "Back", exact: true }).click();
      await expect(page.locator(".card-detail-panel")).toHaveCount(0);
      if (!phone) {
        await page.mouse.move(1435, 985);
        await expect(card.locator(".envelope-expand")).toHaveCSS(
          "opacity",
          "0",
        );
      }
      await expect(card.locator(".envelope-summary h2")).toHaveText(
        "Updated panel card",
      );
      await expect(page.locator("#root")).not.toHaveAttribute("inert", "");
      if (!phone) {
        await page.emulateMedia({ reducedMotion: "reduce" });
        await card.hover();
        await card
          .getByRole("button", {
            name: "Expand card: Updated panel card",
            exact: true,
          })
          .click();
        await expect(panel).toHaveCSS("animation-name", "none");
        await page.keyboard.press("Escape");
        await expect(panel).toHaveCount(0);
        await expect(
          card.getByRole("button", {
            name: "Expand card: Updated panel card",
            exact: true,
          }),
        ).toBeFocused();
      }
    });
  }

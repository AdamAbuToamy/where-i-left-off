import { reminderCollectionFixture } from "./reminderCollectionFixture";
import { test, expect } from "@playwright/test";
import { prepareUniversityPilot } from "./universityFixture";
import {
  normalizeCardSchedule,
  resolveCardSchedule,
} from "../../shared/cardReminderSchedule.mjs";
for (const phone of [false, true])
  test.describe(phone ? "phone reminders" : "desktop reminders", () => {
    test.use({
      viewport: phone
        ? { width: 390, height: 844 }
        : { width: 1440, height: 1000 },
      isMobile: phone,
      hasTouch: phone,
    });
    test("configure exact/relative reminders without local Push permission; settings and inline card share controls", async ({
      page,
      request,
    }) => {
      test.setTimeout(90000);
      const c = await prepareUniversityPilot(
        request,
        "universal-" + (phone ? "phone" : "desktop") + "@example.test",
      );
      const book = "b".repeat(20),
        course = "c".repeat(20);
      for (const [id, name, due] of [
        [book, "Book reminder", ""],
        [course, "Course reminder", "2099-11-18"],
      ])
        await request.patch(
          "http://127.0.0.1:8080/v1/projects/demo-where-i-left-off/databases/(default)/documents/users/" +
            c.uid +
            "/projects/" +
            id,
          {
            headers: { Authorization: "Bearer owner" },
            data: {
              fields: {
                name: { stringValue: name },
                nextStep: { stringValue: "A useful next step" },
                status: { stringValue: "active" },
                kind: { stringValue: "resource" },
                resourceType: { stringValue: id === book ? "book" : "course" },
                dueDate: { stringValue: due },
                rank: { integerValue: "0" },
                revision: { integerValue: "0" },
                mutationId: { stringValue: "seed" },
              },
            },
          },
        );
      const prefs = {
        enabled: true,
        due: false,
        stale: false,
        staleDays: 14,
        defaultTime: "09:00",
        leadMinutes: 0,
        quiet: false,
        quietStart: "22:00",
        quietEnd: "08:00",
        hideContent: true,
        timezone: "Asia/Jerusalem",
        language: "en",
      };
      const cards: Record<string, Record<string, unknown>> = {},
        versions: Record<string, string> = {};

      const collection = reminderCollectionFixture(prefs, (key, schedule) => {
        cards[key.split("__")[1]] = {
          ...(cards[key.split("__")[1]] || {}),
          schedule,
        };
      });
      const actions: string[] = [];
      await page.addInitScript((uid) => {
        localStorage.setItem("language", "en");
        localStorage.setItem("welcome-tour:v2:" + uid, "done");
        Object.defineProperty(Notification, "permission", {
          configurable: true,
          get: () => "denied",
        });
        Notification.requestPermission = async () => {
          (window as unknown as { permissionRequests: number })
            .permissionRequests++;
          return "denied";
        };
        (
          window as unknown as { permissionRequests: number }
        ).permissionRequests = 0;
      }, c.uid);
      const view = (id: string) => {
        const card = cards[id] || { disabled: false, weekly: false, time: "" },
          schedule = card.schedule as
            | Parameters<typeof resolveCardSchedule>[0]
            | undefined;
        const at = schedule
          ? resolveCardSchedule(schedule, id === course ? "2099-11-18" : "")
          : null;
        return {
          ...card,
          projectId: id,
          settingsVersion: versions[id] || "0".repeat(64),
          preferences: prefs,
          status: card.disabled
            ? "disabled"
            : schedule
              ? "scheduled"
              : "not-configured",
          scheduledAt: at === null ? null : new Date(at).toISOString(),
          effectiveAt: at === null ? null : new Date(at).toISOString(),
          providerAccepted: 0,
        };
      };
      await page.route("**/push-config.json", (r) =>
        r.fulfill({ json: { endpoint: "https://reminder-test.workers.dev/" } }),
      );
      await page.route(
        "https://reminder-test.workers.dev/**",
        async (route) => {
          const data = route.request().postDataJSON() || {};
          actions.push(data.action);
          let result: unknown = { ok: true };
          if (data.action === "get")
            result = { preferences: prefs, cards: {}, publicKey: "synthetic" };
          if (data.action === "card-status") result = view(data.projectId);
          if (data.action === "card") {
            expect(data.settingsVersion).toBe(
              versions[data.projectId] || "0".repeat(64),
            );
            const old = cards[data.projectId] || {};
            cards[data.projectId] = {
              ...old,
              disabled: data.disabled,
              weekly: data.weekly,
              time: data.time,
            };
            if (data.schedule)
              cards[data.projectId].schedule = normalizeCardSchedule(
                data.schedule,
                prefs,
              );
            if (data.schedule === null) delete cards[data.projectId].schedule;
            versions[data.projectId] = String(
              Number(versions[data.projectId]?.[0] || 0) + 1,
            ).repeat(64);
            result = view(data.projectId);
          }
          result = collection(data, view(data.projectId)) ?? result;
          await route.fulfill({
            headers: {
              "access-control-allow-origin": "*",
              "access-control-allow-headers":
                "authorization,content-type,x-firebase-appcheck",
              "access-control-allow-methods": "POST,OPTIONS",
            },
            json: { result },
          });
        },
      );
      await page.goto("/");
      await page.getByLabel("Email", { exact: true }).fill(c.email);
      await page.locator(".auth-continue").click();
      await page.getByLabel("Password", { exact: true }).fill(c.password);
      await page
        .locator("form")
        .getByRole("button", { name: "Sign in", exact: true })
        .click();
      await expect(page.locator(".workspace-toolbar")).toBeVisible({
        timeout: 15000,
      });
      await page.goto("/#/settings");
      await page
        .locator(".settings-group>summary")
        .filter({ hasText: "Notifications" })
        .click();
      await page
        .getByRole("link", { name: "Open notification settings", exact: true })
        .click();
      await expect(page.locator(".push-page")).toBeVisible();
      const bookControl = page.locator(".card-reminder-control").filter({
        has: page.locator("summary strong", { hasText: "Book reminder" }),
      });
      await bookControl.locator("summary").click();
      await bookControl
        .getByRole("button", { name: "Add reminder", exact: true })
        .click();
      await bookControl
        .getByRole("combobox", { name: "Reminder schedule", exact: true })
        .selectOption("absolute");
      await bookControl
        .getByLabel("Date and time", { exact: true })
        .fill("2099-11-15T09:00");
      await expect(bookControl.locator("output")).toContainText("Nov");
      await bookControl
        .getByRole("button", { name: "Save reminder", exact: true })
        .click();
      await expect(
        bookControl.getByText("Scheduled on the server", { exact: true }),
      ).toBeVisible();
      expect(cards[book].schedule).toMatchObject({
        mode: "absolute",
        timeZone: "Asia/Jerusalem",
      });
      for (const when of ["2099-11-16T09:00", "2099-11-17T18:00"]) {
        await bookControl
          .getByRole("button", { name: "Add reminder", exact: true })
          .click();
        await bookControl
          .getByLabel("Date and time", { exact: true })
          .fill(when);
        await bookControl
          .getByRole("button", { name: "Save reminder", exact: true })
          .click();
        await expect(
          bookControl.getByRole("button", {
            name: "Add reminder",
            exact: true,
          }),
        ).toBeVisible();
      }
      await expect(bookControl.locator(".card-reminder-item")).toHaveCount(3);
      await bookControl
        .locator(".card-reminder-item")
        .nth(1)
        .getByRole("button", { name: "Edit", exact: true })
        .click();
      await bookControl
        .getByLabel("Date and time", { exact: true })
        .fill("2099-11-16T10:00");
      await bookControl
        .getByRole("button", { name: "Save reminder", exact: true })
        .click();
      await expect(
        bookControl.locator(".card-reminder-item").nth(1),
      ).toContainText("10:00");
      const courseControl = page.locator(".card-reminder-control").filter({
        has: page.locator("summary strong", { hasText: "Course reminder" }),
      });
      await courseControl.locator("summary").click();
      await courseControl
        .getByRole("button", { name: "Add reminder", exact: true })
        .click();
      await courseControl
        .getByRole("combobox", { name: "Reminder schedule", exact: true })
        .selectOption("relative");
      await courseControl
        .getByLabel("How far before?", { exact: true })
        .fill("3");
      await courseControl
        .getByRole("combobox", { name: "Unit", exact: true })
        .selectOption("days");
      await courseControl
        .getByLabel("Time on the reminder day", { exact: true })
        .fill("09:00");
      await courseControl
        .getByRole("button", { name: "Save reminder", exact: true })
        .click();
      await expect(
        courseControl.getByText("Scheduled on the server", { exact: true }),
      ).toBeVisible();
      expect(cards[course].schedule).toMatchObject({
        mode: "relative",
        amount: 3,
        unit: "days",
        localTime: "09:00",
      });
      await bookControl
        .locator(".card-reminder-item")
        .first()
        .getByRole("button", { name: "Cancel reminder", exact: true })
        .click();
      await expect(
        bookControl.getByText("Cancelled", {
          exact: true,
        }),
      ).toBeVisible();
      await expect(bookControl.locator(".card-reminder-item")).toHaveCount(3);
      expect(actions).not.toContain("subscribe");
      const permissionRequests = await page.evaluate(
        () =>
          (window as unknown as { permissionRequests: number })
            .permissionRequests,
      );
      expect(permissionRequests).toBe(0);
      await page.screenshot({
        path:
          ".wrangler/universal-reminders-" +
          (phone ? "phone" : "desktop") +
          ".png",
        fullPage: true,
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.goto("/#/personal");
      const bookCard = page.locator(`[data-project="${book}"]`);
      if (!phone) await bookCard.hover();
      await bookCard
        .getByRole("button", {
          name: "Expand card: Book reminder",
          exact: true,
        })
        .click();
      const detail = page.getByRole("dialog", {
        name: "Book reminder",
        exact: true,
      });
      await expect(detail).toBeVisible();
      await detail
        .getByRole("button", { name: "Card reminder", exact: true })
        .click();
      await expect(
        page.getByRole("dialog", { name: "Card reminder", exact: true }).getByText("Cancelled", { exact: true }),
      ).toBeVisible();
    });
  });

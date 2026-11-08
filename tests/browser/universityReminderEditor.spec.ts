import { test, expect } from "@playwright/test";
import { prepareUniversityPilot } from "./universityFixture";
import {
  normalizeCardSchedule,
  resolveCardSchedule,
} from "../../shared/cardReminderSchedule.mjs";
const root =
  "http://127.0.0.1:8080/v1/projects/demo-where-i-left-off/databases/(default)/documents/";
const encode = (v: unknown): unknown =>
  typeof v === "string"
    ? { stringValue: v }
    : typeof v === "number"
      ? { integerValue: String(v) }
      : typeof v === "boolean"
        ? { booleanValue: v }
        : Array.isArray(v)
          ? { arrayValue: { values: v.map(encode) } }
          : {
              mapValue: {
                fields: Object.fromEntries(
                  Object.entries(v as object).map(([k, value]) => [
                    k,
                    encode(value),
                  ]),
                ),
              },
            };
for (const phone of [false, true])
  test(`university reminder editor and group member — ${phone ? "phone" : "desktop"}`, async ({
    page,
    request,
  }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width: phone ? 390 : 1365, height: 950 });
    const c = await prepareUniversityPilot(
      request,
      "reminder-editor-" + (phone ? "phone" : "desktop") + "@example.test",
    );
    const seed = async (path: string, value: Record<string, unknown>) => {
      const response = await request.patch(root + path, {
        headers: { Authorization: "Bearer owner" },
        data: {
          fields: Object.fromEntries(
            Object.entries(value).map(([key, value]) => [key, encode(value)]),
          ),
        },
      });
      expect(response.ok()).toBe(true);
    };
    const project = "l".repeat(20),
      group = "g".repeat(20),
      groupProject = "m".repeat(20),
      course = {
        id: "course",
        name: "Test course",
        notes: "",
        url: "",
        requires: [],
        topics: [],
        x: 0,
        y: 0,
      };
    const tasks = [
      {
        id: "linked",
        courseId: "course",
        title: "Linked task",
        kind: "assignment",
        due: "2099-11-18T23:59:00Z",
        notes: "",
        url: "",
        done: false,
        reminderProjectId: project,
      },
      {
        id: "no-date",
        courseId: "course",
        title: "No date task",
        kind: "task",
        due: "",
        notes: "",
        url: "",
        done: false,
      },
    ];
    for (const [kind, value] of [
      ["courses", course],
      ...tasks.map((t) => ["tasks", t]),
    ] as const) {
      const item = value as { id: string };
      await seed("users/" + c.uid + "/studyRecords/" + kind + "_" + item.id, {
        kind,
        id: item.id,
        payload: JSON.stringify(value),
        deleted: false,
        revision: 0,
        mutationId: "synthetic",
      });
    }
    await seed("users/" + c.uid + "/projects/" + project, {
      id: project,
      name: "Linked task",
      nextStep: "",
      rank: 1,
      status: "active",
      kind: "deadline",
      dueDate: "2099-11-18",
      revision: 0,
    });
    await seed("groups/" + group, { name: "Test team", ownerUid: "owner" });
    await seed("groups/" + group + "/members/" + c.uid, {
      name: "Member",
      email: c.email,
      role: "member",
      canCreate: false,
    });
    await seed("users/" + c.uid + "/groupMemberships/" + group, {
      groupName: "Test team",
      role: "member",
    });
    await seed("groups/" + group + "/projects/" + groupProject, {
      name: "Group task",
      nextStep: "Team step",
      assignedTo: "another-member",
      rank: 1,
      revision: 0,
      status: "active",
      dueDate: "2099-11-18",
    });
    const prefs = {
      enabled: true,
      due: true,
      stale: false,
      staleDays: 14,
      defaultTime: "09:00",
      leadMinutes: 0,
      quiet: false,
      quietStart: "22:00",
      quietEnd: "08:00",
      hideContent: true,
      timezone: "UTC",
      language: "en",
    };
    const settings: Record<string, Record<string, unknown>> = {},
      versions: Record<string, string> = {};
    await page.addInitScript((uid) => {
      localStorage.setItem("language", "en");
      localStorage.setItem("welcome-tour:v2:" + uid, "done");
      localStorage.setItem(
        "wilo-interaction-settings",
        JSON.stringify({ motion: false, sound: false }),
      );
    }, c.uid);
    await page.route("**/push-config.json", (route) =>
      route.fulfill({
        json: { endpoint: "https://reminder-editor.workers.dev/" },
      }),
    );
    await page.route(
      "https://reminder-editor.workers.dev/**",
      async (route) => {
        const data = route.request().postDataJSON() || {},
          key = (data.groupId || "personal") + "__" + data.projectId;
        let result: unknown = { ok: true };
        if (data.action === "get")
          result = {
            preferences: prefs,
            cards: settings,
            settingsVersions: versions,
            publicKey: "synthetic",
          };
        if (data.action === "card") {
          settings[key] = {
            ...(settings[key] || {}),
            disabled: data.disabled,
            weekly: data.weekly,
            time: data.time,
            ...(data.schedule
              ? { schedule: normalizeCardSchedule(data.schedule, prefs) }
              : {}),
          };
          versions[key] = "1".repeat(64);
        }
        if (data.action === "card" || data.action === "card-status") {
          const card = settings[key] || {},
            snapshot = await request.get(
              root +
                (data.groupId ? "groups/" + data.groupId : "users/" + c.uid) +
                "/projects/" +
                data.projectId,
              { headers: { Authorization: "Bearer owner" } },
            ),
            fields = (await snapshot.json()).fields || {},
            dueDate = fields.dueDate?.stringValue || "",
            schedule = card.schedule as
              | Parameters<typeof resolveCardSchedule>[0]
              | undefined,
            at = schedule ? resolveCardSchedule(schedule, dueDate) : null;
          result = {
            ...card,
            dueDate,
            configured: !!settings[key],
            settingsVersion: versions[key] || "0".repeat(64),
            preferences: prefs,
            status: card.disabled
              ? "disabled"
              : schedule
                ? "scheduled"
                : "not-configured",
            scheduledAt: at ? new Date(at).toISOString() : null,
            effectiveAt: at ? new Date(at).toISOString() : null,
          };
        }
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
    await page.locator(".auth-journey .auth-continue").click();
    await page.getByLabel("Password", { exact: true }).fill(c.password);
    await page
      .locator("form")
      .getByRole("button", { name: "Sign in", exact: true })
      .click();
    await expect(page.locator(".page-header")).toBeVisible();
    await page.goto("/#/university");
    await page
      .locator(".uni-deadline")
      .filter({ hasText: "Linked task" })
      .click();
    const dialog = page.locator("dialog[open]");
    await dialog.locator("input[name=title]").fill("Edited linked task");
    await dialog.getByRole("button", { name: "Save", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect
      .poll(async () => {
        const response = await request.get(
          root + "users/" + c.uid + "/projects/" + project,
          { headers: { Authorization: "Bearer owner" } },
        );
        return (await response.json()).fields?.id;
      })
      .toBeUndefined();
    await page
      .locator(".uni-deadline-row")
      .filter({ hasText: "Edited linked task" })
      .getByRole("button", { name: "Set reminder", exact: true })
      .click();
    const editor = page.locator("dialog[open] .card-reminder-control");
    await editor
      .getByRole("combobox", { name: "Reminder schedule", exact: true })
      .selectOption("relative");
    await editor
      .getByRole("combobox", { name: "Unit", exact: true })
      .selectOption("days");
    await editor.getByLabel("How far before?", { exact: true }).fill("3");
    await editor
      .getByLabel("Time on the reminder day", { exact: true })
      .fill("09:00");
    await editor
      .getByRole("button", { name: "Save reminder", exact: true })
      .click();
    await expect(
      editor.getByText("Reminder saved.", { exact: true }),
    ).toBeVisible();
    expect(settings["personal__" + project].schedule).toMatchObject({
      amount: 3,
      localTime: "09:00",
    });
    await page.locator("dialog[open]>header button").click();
    await page
      .locator(".uni-deadline-row")
      .filter({ hasText: "No date task" })
      .getByRole("button", { name: "Set reminder", exact: true })
      .click();
    await expect(
      editor.getByLabel("Date and time", { exact: true }),
    ).toBeVisible();
    await editor
      .getByLabel("Date and time", { exact: true })
      .fill("2099-11-15T09:00");
    await editor
      .getByRole("button", { name: "Save reminder", exact: true })
      .click();
    await expect(
      editor.getByText("Reminder saved.", { exact: true }),
    ).toBeVisible();
    await page.locator("dialog[open]>header button").click();
    await page.goto("/#/groups/" + group);
    const card = page.locator('[data-project="' + groupProject + '"]');
    if (!phone) await card.hover();
    await card
      .getByRole("button", { name: "Expand card: Group task", exact: true })
      .click();
    const panel = page.locator(".card-detail-panel");
    await panel.locator(".card-reminder-control>summary").click();
    await expect(
      panel.getByLabel("How far before?", { exact: true }),
    ).toBeVisible();
    await panel
      .getByRole("button", { name: "Save reminder", exact: true })
      .click();
    await expect(
      panel.getByText("Reminder saved.", { exact: true }),
    ).toBeVisible();
    expect(settings[group + "__" + groupProject].schedule).toMatchObject({
      mode: "relative",
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path:
        ".wrangler/reminder-editor-" + (phone ? "phone" : "desktop") + ".png",
      fullPage: true,
    });
  });

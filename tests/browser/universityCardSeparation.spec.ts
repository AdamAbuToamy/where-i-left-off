import { test, expect } from "@playwright/test";
import { prepareUniversityPilot } from "./universityFixture";
for (const phone of [false, true])
  test(`university assignments stay outside personal cards ${phone ? "phone" : "desktop"}`, async ({
    page,
    request,
  }) => {
    await page.setViewportSize(
      phone ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
    );
    const c = await prepareUniversityPilot(
        request,
        `assignment-separation-${phone}@example.test`,
      ),
      helper = "h".repeat(20),
      personal = "p".repeat(20),
      explicit = "e".repeat(20);
    const root = `http://127.0.0.1:8080/v1/projects/demo-where-i-left-off/databases/(default)/documents/users/${c.uid}`;
    const seed = async (
      path: string,
      value: Record<string, string | number | boolean>,
    ) => {
      const response = await request.patch(root + "/" + path, {
        headers: { Authorization: "Bearer owner" },
        data: {
          fields: Object.fromEntries(
            Object.entries(value).map(([k, v]) => [
              k,
              typeof v === "number"
                ? { integerValue: String(v) }
                : typeof v === "boolean"
                  ? { booleanValue: v }
                  : { stringValue: v },
            ]),
          ),
        },
      });
      expect(response.ok()).toBe(true);
    };
    const course = {
      id: "course",
      name: "Separation course",
      url: "",
      notes: "",
      requires: [],
      topics: [],
      x: 0,
      y: 0,
    };
    const task = {
      id: "task",
      courseId: "course",
      title: "Existing assignment",
      kind: "assignment",
      due: "2099-11-18T23:59:00Z",
      done: false,
      notes: "",
      url: "",
      reminderProjectId: helper,
    };
    for (const [kind, item] of [
      ["courses", course],
      ["tasks", task],
    ] as const)
      await seed("studyRecords/" + kind + "_" + item.id, {
        kind,
        id: item.id,
        payload: JSON.stringify(item),
        revision: 0,
        deleted: false,
        mutationId: "seed",
      });
    for (const id of [helper, personal, explicit])
      await seed("projects/" + id, {
        name:
          id === explicit ? "Explicit personal copy" : "Existing assignment",
        nextStep: "Next",
        kind: "deadline",
        resourceType: "course",
        dueDate: "2099-11-18",
        status: "active",
        rank: 1,
        revision: 0,
        mutationId: "seed",
      });
    await page.addInitScript((uid) => {
      localStorage.setItem("language", "ar");
      localStorage.setItem("welcome-tour:v2:" + uid, "done");
    }, c.uid);
    await page.route("**/push-config.json", (r) =>
      r.fulfill({ status: 503, body: "{}" }),
    );
    await page.goto("/");
    await page.locator("input[type=email]").fill(c.email);
    await page.locator(".auth-continue").click();
    await page.locator("input[type=password]").fill(c.password);
    await page.locator("form button[type=submit]").click();
    await expect(page.locator(".project-card")).toHaveCount(2);
    await expect(page.locator(`[data-project="${helper}"]`)).toHaveCount(0);
    await expect(page.locator(`[data-project="${personal}"]`)).toBeVisible();
    await expect(page.locator(`[data-project="${explicit}"]`)).toBeVisible();
    await page.goto("/#/university");
    await expect(
      page.locator(".uni-deadline").filter({ hasText: "Existing assignment" }),
    ).toBeVisible();
    await page
      .locator(".uni-header-actions .uni-menu")
      .first()
      .locator("summary")
      .click();
    await page.getByRole("button", { name: "إضافة مهمة", exact: true }).click();
    await page
      .locator("dialog[open] input[name=title]")
      .fill("Manual assignment");
    await page
      .locator("dialog[open]")
      .getByRole("button", { name: "حفظ", exact: true })
      .click();
    await expect(page.locator("dialog[open]")).toHaveCount(0);
    await page.goto("/#/university?courseId=course");
    await page.getByRole("button",{name:"المهام والمواعيد",exact:true}).click();
    await expect(page.getByText("Manual assignment",{exact:true})).toBeVisible();
    await expect(page.getByText("Existing assignment",{exact:true})).toBeVisible();
    await page.goto("/#/personal");
    await expect(page.locator(".project-card")).toHaveCount(2);
    await expect(page.locator(`[data-project="${helper}"]`)).toHaveCount(0);
    await page.reload();
    await expect(page.locator(".project-card")).toHaveCount(2);
    const projects = await request.get(root + "/projects", {
      headers: { Authorization: "Bearer owner" },
    });
    expect((await projects.json()).documents).toHaveLength(3);
    const study = await request.get(root + "/studyRecords", {
      headers: { Authorization: "Bearer owner" },
    });
    const records = (await study.json()).documents.filter(
      (d: { fields: { kind: { stringValue: string } } }) =>
        d.fields.kind.stringValue === "tasks",
    );
    expect(records).toHaveLength(2);
    const tasks = records.map(
      (d: { fields: { payload: { stringValue: string } } }) =>
        JSON.parse(d.fields.payload.stringValue),
    );
    expect(
      tasks.every((t: { courseId: string }) => t.courseId === "course"),
    ).toBe(true);
    expect(
      tasks.find((t: { id: string }) => t.id === "task").reminderProjectId,
    ).toBe(helper);
    await page.screenshot({
      path: `/tmp/wilo-assignment-separation-${phone ? "phone" : "desktop"}.png`,
      fullPage: true,
    });
  });

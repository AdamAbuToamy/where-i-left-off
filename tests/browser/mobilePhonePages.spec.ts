import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { prepareUniversityPilot } from "./universityFixture";
test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});
test("phone separates secondary tools, course index and course details; records throttled opening frames", async ({
  page,
  request,
}) => {
  test.setTimeout(120000);
  const c = await prepareUniversityPilot(request);
  for (let i = 0; i < 37; i++)
    await request.patch(
      "http://127.0.0.1:8080/v1/projects/demo-where-i-left-off/databases/(default)/documents/users/" +
        c.uid +
        "/projects/" +
        "density" +
        String(i).padStart(13, "0"),
      {
        headers: { Authorization: "Bearer owner" },
        data: {
          fields: {
            name: { stringValue: "Phone density " + i },
            nextStep: { stringValue: "Keep working" },
            status: { stringValue: "later" },
            rank: { integerValue: String(i) },
            revision: { integerValue: "0" },
            mutationId: { stringValue: "fixture" },
          },
        },
      },
    );
  await page.addInitScript((uid) => {
    localStorage.setItem("language", "en");
    localStorage.setItem("welcome-tour:v2:" + uid, "done");
  }, c.uid);
  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill(c.email);
  await page.getByLabel("Password", { exact: true }).fill(c.password);
  await page
    .locator("form")
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  const bar = page.locator(".mobile-bottom-navigation");
  await expect(bar).toBeVisible({ timeout: 15000 });
  await expect(
    page.locator(".workspace-command-bar .choice-picker"),
  ).toHaveCount(0);
  expect(
    (await page.locator(".workspace-command-bar").boundingBox())!.height,
  ).toBeLessThan(110);
  await page.screenshot({
    path: ".wrangler/mobile-pages-home.png",
    animations: "disabled",
  });
  await page.getByRole("button", { name: "View tools", exact: true }).tap();
  const tools = page.getByRole("dialog", { name: "View tools", exact: true });
  await expect(tools).toBeVisible();
  expect((await tools.boundingBox())!.width).toBe(390);
  await expect(tools.getByRole("combobox")).toHaveCount(2);
  await tools.getByRole("button", { name: "Show results", exact: true }).tap();
  const client = await page.context().newCDPSession(page);
  await client.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  async function measureOpening(selector: string) {
    return page.evaluate(async (selector) => {
      const gaps: number[] = [];
      let last = performance.now();
      document.querySelector<HTMLButtonElement>(selector)!.click();
      for (let i = 0; i < 30; i++)
        await new Promise<void>((resolve) =>
          requestAnimationFrame((now) => {
            gaps.push(now - last);
            last = now;
            resolve();
          }),
        );
      return {
        samples: gaps.length,
        maxMs: Math.max(...gaps),
        over50ms: gaps.filter((n) => n > 50).length,
      };
    }, selector);
  }
  const assistantFrames = await measureOpening(".mobile-wilo-action");
  const assistant = page.locator("#wilo-assistant");
  await expect(assistant).toBeVisible();
  await expect(assistant).toHaveCSS("transform", "none");
  await expect(assistant.locator("textarea")).not.toBeFocused();
  await expect(page.locator("html")).toHaveAttribute(
    "data-phone-surface",
    "on",
  );
  await page
    .getByRole("button", { name: "Close assistant", exact: true })
    .tap();
  const formFrames = await measureOpening('[data-tour="add-project"]');
  const form = page.getByRole("dialog", { name: "New card", exact: true });
  await expect(form).toBeVisible();
  await expect(form.locator("input").first()).not.toBeFocused();
  await expect(page.locator("body")).not.toHaveCSS("position", "fixed");
  await form.locator("#project-name").fill("Phone simplified save");
  await form.locator("#project-next-step").fill("A useful next step");
  await form.getByText("Notes and links", { exact: true }).tap();
  await form.locator("#new-description").fill("Saved from a closed group");
  await form.getByText("Notes and links", { exact: true }).tap();
  await form.getByRole("button", { name: "Save card", exact: true }).tap();
  await expect(form).toHaveCount(0);
  await expect(
    page
      .locator(".envelope-summary h2")
      .filter({ hasText: "Phone simplified save" }),
  ).toBeVisible();
  await writeFile(
    ".wrangler/mobile-pages-frames.json",
    JSON.stringify(
      {
        cpuThrottle: 4,
        assistantOpening: assistantFrames,
        addCardOpening: formFrames,
        physicalDevice: false,
      },
      null,
      2,
    ),
  );
  await client.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  await bar.getByRole("button", { name: "More", exact: true }).tap();
  await page.screenshot({
    path: ".wrangler/mobile-pages-more.png",
    animations: "disabled",
  });
  await page
    .locator(".page-navigation")
    .getByRole("button", { name: "Back", exact: true })
    .tap();
  await page.goto("/#/university");
  await expect(page.locator(".study-phone-pages")).toBeVisible();
  await expect(page.locator(".study-overview-disclosure")).not.toHaveAttribute(
    "open",
  );
  await page.locator(".study-trial-tools summary").click();
  await page.locator(".study-upload input").setInputFiles({
    name: "phone-plan.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        version: 1,
        courses: [
          {
            id: "phone-course-a",
            name: "Phone course A",
            notes: "Useful notes",
            url: "",
            requires: [],
            topics: [],
            x: 40,
            y: 40,
          },
          {
            id: "phone-course-b",
            name: "Phone course B",
            notes: "",
            url: "",
            requires: [],
            topics: [],
            x: 330,
            y: 210,
          },
        ],
        tasks: [],
        lessons: [],
      }),
    ),
  });
  await page
    .getByRole("button", { name: "Confirm addition", exact: true })
    .click();
  await expect(page.locator(".study-course-browser")).toBeVisible();
  await expect(page.locator(".study-trial-panel")).toHaveCount(0);
  await page.screenshot({
    path: ".wrangler/mobile-pages-university.png",
    animations: "disabled",
  });
  await page
    .locator(".study-course-choice")
    .filter({ hasText: "Phone course A" })
    .tap();
  await expect(page.locator(".study-course-browser")).toHaveCount(0);
  await expect(page.locator(".study-trial-panel")).toContainText(
    "Phone course A",
  );
  await page
    .getByRole("button", { name: "Back to courses", exact: true })
    .tap();
  await expect(page.locator(".study-course-browser")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { prepareUniversityPilot } from "./universityFixture";

async function login(
  page: Page,
  email: string,
  password: string,
  uid: string,
  language = "en",
) {
  await page.addInitScript(
    ({ uid, language }) => {
      localStorage.setItem("language", language);
      localStorage.setItem("welcome-tour:v2:" + uid, "done");
    },
    { uid, language },
  );
  await page.goto("/");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page
    .locator("form")
    .getByRole("button", {
      name: language === "ar" ? "تسجيل الدخول" : "Sign in",
      exact: true,
    })
    .click();
  await expect(page.locator(".workspace-command-bar")).toBeVisible({
    timeout: 15000,
  });
}
async function addMainCard(page: Page, name: string) {
  await page.getByRole("button", { name: "New card", exact: true }).click();
  await page.locator("#project-name").fill(name);
  await page
    .locator("#project-next-step")
    .fill("Keep the original project data");
  await page.getByRole("button", { name: "Save card", exact: true }).click();
  await expect(
    page.locator(".envelope-summary h2").filter({ hasText: name }),
  ).toBeVisible();
}
async function dragNode(
  page: Page,
  node: ReturnType<Page["locator"]>,
  x: number,
  y: number,
) {
  const box = await node.locator(".plan-node-grip").boundingBox();
  if (!box) throw new Error("No node grip");
  await page.mouse.move(
    box.x + Math.min(60, box.width / 2),
    box.y + box.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(x, y, { steps: 12 });
  await page.mouse.up();
}
async function connect(
  page: Page,
  source: ReturnType<Page["locator"]>,
  target: ReturnType<Page["locator"]>,
) {
  await source.locator(".plan-pin").hover();
  const from = await source.locator(".plan-pin").boundingBox(),
    to = await target.locator(".plan-pin").boundingBox();
  if (!from || !to) throw new Error("Missing pin");
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, {
    steps: 14,
  });
  await page.mouse.up();
}

test("desktop planning board keeps main order, saves manual ropes/notes/circles and restores from the account", async ({
  page,
  request,
  browser,
}) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const credentials = await prepareUniversityPilot(request);
  await login(page, credentials.email, credentials.password, credentials.uid);
  await page.goto("/#/personal");
  await addMainCard(page, "Plan Alpha");
  await addMainCard(page, "Plan Beta");
  expect(
    (await page.locator(".workspace-command-bar").boundingBox())!.height,
  ).toBeLessThan(100);
  await page
    .locator(".envelope-summary h2")
    .filter({ hasText: "Plan Alpha" })
    .hover();
  await expect(page.locator(".rough-annotation")).toHaveCount(0);
  await expect(page.locator(".board-pin,.pinboard-toolbar")).toHaveCount(0);
  const originalOrder = await page
    .locator("[data-project-id]")
    .evaluateAll((nodes) =>
      nodes.map((node) => (node as HTMLElement).dataset.projectId),
    );
  await page
    .getByRole("button", { name: "Planning board", exact: true })
    .click();
  const board = page.locator(".planning-board-dialog[open]");
  await expect(board).toBeVisible();
  await board.getByRole("button", { name: "Add card", exact: true }).click();
  await board
    .locator(".planning-card-picker")
    .getByRole("button", { name: "Plan Alpha", exact: true })
    .click();
  await board
    .locator(".planning-card-picker")
    .getByRole("button", { name: "Plan Beta", exact: true })
    .click();
  await board.getByRole("button", { name: "Add card", exact: true }).click();
  const alpha = board.locator(".react-flow__node-card").filter({
      has: page.getByRole("heading", { name: "Plan Alpha", exact: true }),
    }),
    beta = board.locator(".react-flow__node-card").filter({
      has: page.getByRole("heading", { name: "Plan Beta", exact: true }),
    });
  await expect(alpha).toBeVisible();
  await expect(board.locator(".react-flow__edge")).toHaveCount(0);
  const canvas = (await board.locator(".planning-canvas").boundingBox())!;
  await dragNode(page, alpha, canvas.x + 210, canvas.y + 190);
  await dragNode(page, beta, canvas.x + canvas.width - 290, canvas.y + 350);
  await alpha.getByRole("heading", { name: "Plan Alpha", exact: true }).hover();
  await expect(alpha.locator(".rough-annotation")).toHaveCount(1);
  await page.screenshot({
    path: ".wrangler/planning-hover.png",
    animations: "disabled",
  });
  await board.getByRole("button", { name: "Sticky note", exact: true }).click();
  const note = board.locator(".react-flow__node-note").last();
  await expect(note).toBeVisible();
  await note.getByRole("textbox", { name: "Sticky note", exact: true }).click();
  await note
    .getByRole("textbox", { name: "Sticky note", exact: true })
    .pressSequentially("Only on my planning board", { delay: 25 });
  await expect(note.getByRole("textbox")).toHaveValue(
    "Only on my planning board",
  );
  await dragNode(
    page,
    note,
    canvas.x + canvas.width / 2,
    canvas.y + canvas.height - 180,
  );
  await connect(page, alpha, note);
  await expect(board.locator(".react-flow__edge-rope")).toHaveCount(1);
  await board.getByRole("button", { name: "Circle pen", exact: true }).click();
  const bounds = (await alpha.boundingBox())!,
    cx = bounds.x + bounds.width / 2,
    cy = bounds.y + bounds.height / 2,
    rx = bounds.width / 2 + 22,
    ry = bounds.height / 2 + 20;
  await page.mouse.move(cx + rx, cy);
  await page.mouse.down();
  for (let i = 1; i <= 72; i++) {
    const angle = (i / 72) * Math.PI * 2;
    await page.mouse.move(cx + rx * Math.cos(angle), cy + ry * Math.sin(angle));
  }
  await page.mouse.up();
  await expect(board.locator("[data-planning-circle]")).toHaveCount(1);
  await board.getByRole("button", { name: "Move", exact: true }).click();
  await board.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(board.locator("[data-planning-circle]")).toHaveCount(0);
  await board.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(board.locator("[data-planning-circle]")).toHaveCount(1);
  await expect(board.locator(".planning-save")).toHaveText("Saved", {
    timeout: 15000,
  });
  await page.screenshot({
    path: ".wrangler/planning-desktop.png",
    fullPage: false,
    animations: "disabled",
  });
  await alpha.getByRole("button", { name: "Open card", exact: true }).click();
  await expect(board).toHaveCount(0);
  await expect(page.locator(".envelope-content:visible")).toContainText(
    "Keep the original project data",
  );
  expect(
    await page
      .locator("[data-project-id]")
      .evaluateAll((nodes) =>
        nodes.map((node) => (node as HTMLElement).dataset.projectId),
      ),
  ).toEqual(originalOrder);
  const other = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const otherPage = await other.newPage();
  await login(
    otherPage,
    credentials.email,
    credentials.password,
    credentials.uid,
  );
  await otherPage
    .getByRole("button", { name: "Planning board", exact: true })
    .click();
  const restored = otherPage.locator(".planning-board-dialog[open]");
  await expect(
    restored.getByRole("textbox", { name: "Sticky note", exact: true }),
  ).toHaveValue("Only on my planning board", { timeout: 15000 });
  await expect(restored.locator(".react-flow__edge-rope")).toHaveCount(1);
  await expect(restored.locator("[data-planning-circle]")).toHaveCount(1);
  await other.close();
});

test("phone has original cards and compact controls without loading the desktop board", async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const credentials = await prepareUniversityPilot(request),
    requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await login(
    page,
    credentials.email,
    credentials.password,
    credentials.uid,
    "ar",
  );
  await page.goto("/#/personal");
  await page.getByRole("button", { name: "بطاقة جديدة", exact: true }).click();
  await page.locator("#project-name").fill("Phone search card");
  await page.locator("#project-next-step").fill("Check compact search");
  await page.getByRole("button", { name: "حفظ البطاقة", exact: true }).click();
  await expect(
    page
      .locator(".envelope-summary h2")
      .filter({ hasText: "Phone search card" }),
  ).toBeVisible();

  await expect(
    page.getByRole("button", { name: "لوح الخطة", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".planning-board-dialog")).toHaveCount(0);
  expect(requests.some((url) => url.includes("PlanningBoardDialog-"))).toBe(
    false,
  );
  await page.locator(".compact-workspace-search summary").click();
  await expect(page.locator(".compact-search-panel input")).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator(".compact-workspace-search")
        .evaluate(
          (element) => getComputedStyle(element, "::details-content").opacity,
        ),
    )
    .toBe("1");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({
    path: ".wrangler/planning-main-phone.png",
    fullPage: true,
    animations: "disabled",
  });
});

test("offline board edits survive reload and removing a board card preserves its source", async ({
  page,
  request,
  context,
}) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const credentials = await prepareUniversityPilot(request);
  await login(page, credentials.email, credentials.password, credentials.uid);
  await page.goto("/#/personal");
  await addMainCard(page, "Independent source");
  await page
    .getByRole("button", { name: "Planning board", exact: true })
    .click();
  const board = page.locator(".planning-board-dialog[open]");
  await board.getByRole("button", { name: "Add card", exact: true }).click();
  await board
    .locator(".planning-card-picker")
    .getByRole("button", { name: "Independent source", exact: true })
    .click();
  await board.getByRole("button", { name: "Add card", exact: true }).click();
  const card = board.locator(".react-flow__node-card").filter({
    has: page.getByRole("heading", {
      name: "Independent source",
      exact: true,
    }),
  });
  await card
    .getByRole("button", { name: "Remove from board", exact: true })
    .click();
  await expect(card).toHaveCount(0);
  await expect(board.locator(".planning-save")).toHaveText("Saved", {
    timeout: 15000,
  });
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await context.setOffline(true);
  await board.getByRole("button", { name: "Sticky note", exact: true }).click();
  const note = board
    .getByRole("textbox", { name: "Sticky note", exact: true })
    .last();
  await note.click();
  await note.pressSequentially("Offline draft", { delay: 25 });
  await expect(note).toHaveValue("Offline draft");
  await board.getByRole("button", { name: "Close board", exact: true }).click();
  await expect(
    page
      .locator(".envelope-summary h2")
      .filter({ hasText: "Independent source" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Planning board", exact: true }),
  ).toBeVisible({ timeout: 15000 });
  await page
    .getByRole("button", { name: "Planning board", exact: true })
    .click();
  await expect(
    board.getByRole("textbox", { name: "Sticky note", exact: true }).last(),
  ).toHaveValue("Offline draft");
  await context.setOffline(false);
  await expect(board.locator(".planning-save")).toHaveText("Saved", {
    timeout: 25000,
  });
});

test("relationships belong to card ropes in the board and survive reload without Work hub", async ({
  page,
  request,
}) => {
  test.setTimeout(70000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const c = await prepareUniversityPilot(request);
  await request.delete(
    "http://127.0.0.1:8080/v1/projects/demo-where-i-left-off/databases/(default)/documents/users/" +
      c.uid +
      "/planningBoards/personal",
    { headers: { Authorization: "Bearer owner" } },
  );
  await login(page, c.email, c.password, c.uid);
  await page.goto("/#/personal");
  await addMainCard(page, "Relationship source");
  await addMainCard(page, "Relationship target");
  await page
    .getByRole("button", { name: "Planning board", exact: true })
    .click();
  const board = page.locator(".planning-board-dialog[open]");
  await board.getByRole("button", { name: "Add card", exact: true }).click();
  for (const name of ["Relationship source", "Relationship target"])
    await board
      .locator(".planning-card-picker")
      .getByRole("button", { name, exact: true })
      .click();
  await board.getByRole("button", { name: "Add card", exact: true }).click();
  const source = board
      .locator(".react-flow__node-card")
      .filter({
        has: page.getByRole("heading", {
          name: "Relationship source",
          exact: true,
        }),
      }),
    target = board
      .locator(".react-flow__node-card")
      .filter({
        has: page.getByRole("heading", {
          name: "Relationship target",
          exact: true,
        }),
      }),
    box = (await board.locator(".planning-canvas").boundingBox())!;
  await dragNode(page, source, box.x + 250, box.y + 180);
  await dragNode(page, target, box.x + box.width - 300, box.y + 400);
  await connect(page, source, target);
  await expect(board.locator(".react-flow__edge-rope")).toHaveCount(1);
  async function selectRope() {
    const point = await board
      .locator(".react-flow__edge-interaction")
      .evaluate((path) => {
        const p = path as SVGPathElement,
          point = p.getPointAtLength(p.getTotalLength() / 2),
          matrix = p.getScreenCTM()!;
        return {
          x: point.x * matrix.a + point.y * matrix.c + matrix.e,
          y: point.x * matrix.b + point.y * matrix.d + matrix.f,
        };
      });
    await page.mouse.click(point.x, point.y);
  }
  await selectRope();
  await board.getByRole("button", { name: "Depends on", exact: true }).click();
  await expect(
    board.getByRole("button", { name: "Depends on", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(board.locator(".planning-relation-status")).toHaveCount(0, {
    timeout: 15000,
  });
  await expect(board.locator(".planning-save")).toHaveText("Saved", {
    timeout: 15000,
  });
  await page.reload();
  await page
    .getByRole("button", { name: "Planning board", exact: true })
    .click();
  await expect(board.locator(".react-flow__edge-rope")).toHaveCount(1);
  await selectRope();
  await expect(
    board.getByRole("button", { name: "Depends on", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "Work hub", exact: true }),
  ).toHaveCount(0);
});

test("board relationships, blockers, focus, areas, conversion and return-to-board work together", async ({
  page,
  request,
}) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const c = await prepareUniversityPilot(request, "board-upgrade@example.test");
  await login(page, c.email, c.password, c.uid);
  for (const name of ["Build arm", "Choose motor", "Unrelated work"])
    await addMainCard(page, name);
  const ids = await page
    .locator("[data-project-id]")
    .evaluateAll((nodes) =>
      Object.fromEntries(
        nodes.map((n) => [
          n.querySelector("h2")?.textContent || "",
          (n as HTMLElement).dataset.projectId,
        ]),
      ),
    );
  const a = ids["Build arm"],
    b = ids["Choose motor"],
    other = ids["Unrelated work"];
  expect(a && b && other).toBeTruthy();
  const state = {
    version: 1,
    items: [
      { id: a, kind: "card", projectId: a, x: 0, y: 100 },
      { id: b, kind: "card", projectId: b, x: 500, y: 100 },
      { id: other, kind: "card", projectId: other, x: 1000, y: 450 },
      {
        id: "area",
        kind: "zone",
        title: "Build",
        x: -30,
        y: 30,
        width: 380,
        height: 400,
      },
    ],
    threads: [],
    circles: [],
  };
  const seeded = await request.patch(
    `http://127.0.0.1:8080/v1/projects/demo-where-i-left-off/databases/(default)/documents/users/${c.uid}/planningBoards/personal`,
    {
      headers: { Authorization: "Bearer owner" },
      data: {
        fields: {
          version: { integerValue: "1" },
          scope: { stringValue: "" },
          payload: { stringValue: JSON.stringify(state) },
          revision: { integerValue: "1" },
          mutationId: { stringValue: "fixture" },
        },
      },
    },
  );
  expect(seeded.ok()).toBe(true);
  await page
    .getByRole("button", { name: "Planning board", exact: true })
    .click();
  const board = page.locator(".planning-board-dialog[open]");
  await expect(board).toBeVisible();
  const alpha = board
    .locator(".react-flow__node-card")
    .filter({
      has: page.getByRole("heading", { name: "Build arm", exact: true }),
    });
  const beta = board
    .locator(".react-flow__node-card")
    .filter({
      has: page.getByRole("heading", { name: "Choose motor", exact: true }),
    });
  await expect(board.getByLabel("Area name", { exact: true })).toHaveValue(
    "Build",
  );
  await board.getByRole("button", { name: "Fit all", exact: true }).click();
  await connect(page, alpha, beta);
  await expect(board.locator(".react-flow__edge-rope")).toHaveCount(1);
  await board.getByRole("button", { name: "Depends on", exact: true }).click();
  await expect(alpha.locator(".plan-blockers")).toContainText("Choose motor");
  await board
    .getByRole("textbox", { name: "Relationship note", exact: true })
    .pressSequentially("Order motor first", { delay: 10 });
  await expect(
    board.getByRole("textbox", { name: "Relationship note", exact: true }),
  ).toHaveValue("Order motor first");
  await board.getByRole("button", { name: "Part of", exact: true }).click();
  await expect(alpha.locator(".plan-blockers")).toHaveCount(0);
  await board.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(alpha.locator(".plan-blockers")).toBeVisible();
  await alpha.getByRole("heading", { name: "Build arm", exact: true }).click();
  await board
    .getByRole("button", { name: "Focus relationships", exact: true })
    .click();
  await expect(board.locator(".plan-dimmed")).toHaveCount(1);
  await board
    .getByRole("button", { name: "Focus relationships", exact: true })
    .click();
  const before = (await alpha.boundingBox())!;
  const outside = board
    .locator(".react-flow__node-card")
    .filter({
      has: page.getByRole("heading", { name: "Unrelated work", exact: true }),
    });
  const outBefore = (await outside.boundingBox())!;
  const grip = (await board.locator(".plan-zone-grip").boundingBox())!;
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    grip.x + grip.width / 2 + 55,
    grip.y + grip.height / 2 + 35,
    { steps: 10 },
  );
  await page.mouse.up();
  await expect
    .poll(async () => Math.round((await alpha.boundingBox())!.x - before.x))
    .toBeGreaterThan(30);
  expect(Math.abs((await outside.boundingBox())!.x - outBefore.x)).toBeLessThan(
    3,
  );
  await board
    .locator(".react-flow__node-zone")
    .getByRole("button", { name: "Remove from board", exact: true })
    .click();
  await expect(board.locator(".react-flow__node-zone")).toHaveCount(0);
  await expect(board.locator(".react-flow__node-card")).toHaveCount(3);
  await board.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(board.locator(".react-flow__node-zone")).toHaveCount(1);
  const area=board.locator(".react-flow__node-zone");
  await area.locator(".plan-zone-grip").click();
  const oldArea=(await area.boundingBox())!;
  const resize=(await area.locator(".react-flow__resize-control.bottom.right").boundingBox())!;
  await page.mouse.move(resize.x+resize.width/2,resize.y+resize.height/2);await page.mouse.down();
  await page.mouse.move(resize.x+resize.width/2+50,resize.y+resize.height/2+30,{steps:10});await page.mouse.up();
  await expect.poll(async()=>(await area.boundingBox())!.width-oldArea.width).toBeGreaterThan(30);

  await board.getByRole("button", { name: "Sticky note", exact: true }).click();
  const note = board.locator(".react-flow__node-note").last();
  await note.getByRole("textbox").fill("Prepare wiring diagram");
  await note
    .getByRole("button", { name: "Convert to card", exact: true })
    .click();
  await expect(board.locator(".react-flow__node-note")).toHaveCount(0);
  const converted = board
    .locator(".react-flow__node-card")
    .filter({
      has: page.getByRole("heading", {
        name: "Prepare wiring diagram",
        exact: true,
      }),
    });
  await expect(converted).toBeVisible();
  const viewBefore = await board
    .locator(".react-flow__viewport")
    .getAttribute("style");
  await converted
    .getByRole("button", { name: "Open card", exact: true })
    .click();
  await expect(board).toHaveCount(0);
  const panel = page.locator(".card-detail-panel");
  await expect(panel).toBeVisible();
  await panel.getByRole("button", { name: "Notes", exact: true }).click();
  await expect(
    panel.getByText("Prepare wiring diagram", { exact: true }).last(),
  ).toBeVisible();
  await panel.getByRole("button", { name: "Back", exact: true }).click();
  await expect(board).toBeVisible();
  expect(
    await board.locator(".react-flow__viewport").getAttribute("style"),
  ).toBe(viewBefore);
  await board.getByRole("button", { name: "Fit all", exact: true }).click();
  await expect(board.locator(".planning-save")).toHaveText("Saved", {
    timeout: 15000,
  });
  await page.screenshot({
    path: ".wrangler/planning-upgraded.png",
    animations: "disabled",
  });
  await board.getByRole("button", { name: "Close board", exact: true }).click();
  await page.reload();
  await page
    .getByRole("button", { name: "Planning board", exact: true })
    .click();
  await expect(board.locator(".react-flow__node-card")).toHaveCount(4);
  await expect(
    board.getByRole("textbox", { name: "Area name", exact: true }),
  ).toHaveValue("Build");
  await expect(board.locator(".plan-blockers")).toContainText("Choose motor");
});

import { test, expect } from "@playwright/test";
import { pilot } from "./productivityFixture";
test("task 7: injected provider receives only a validated open-card reference and edits it after Apply", async ({
  page,
  request,
}) => {
  test.setTimeout(60000);
  const c = await pilot(page, request, ["Context card"]);
  await page.evaluate(
    (uid) =>
      sessionStorage.setItem(
        "wilo-pollinations:" + uid,
        "sk_synthetic_context_test",
      ),
    c.uid,
  );
  let received = false;
  await page.route("https://gen.pollinations.ai/**", async (route) => {
    const payload = route.request().postDataJSON(),
      tool = (name: string, args: unknown) => ({
        id: "test-call",
        type: "function",
        function: { name, arguments: JSON.stringify(args) },
      });
    if (
      payload.tools?.some(
        (t: { function: { name: string } }) =>
          t.function.name === "request_workspace",
      )
    ) {
      await route.fulfill({
        json: {
          choices: [
            {
              message: {
                tool_calls: [
                  tool("request_workspace", {
                    requirements: [],
                    functions: ["update_card"],
                  }),
                ],
              },
            },
          ],
        },
      });
      return;
    }
    const message = payload.messages.findLast(
      (m: { role: string; content: string }) =>
        m.role === "user" && m.content.includes("ACCOUNT CONTEXT (untrusted):"),
    );
    const context = JSON.parse(
      message.content
        .split("\n\nACCOUNT CONTEXT (untrusted):\n")[1]
        .split("\n\nRejected proposal")[0],
    );
    expect(context.controls.site.selection.card).toEqual({
      scope: "personal",
      id: c.cards[0].id,
      name: "Context card",
    });
    expect(context.controls.site.adminExperience).toBe(true);
    received = true;
    await route.fulfill({
      json: {
        choices: [
          {
            message: {
              tool_calls: [
                tool("update_card", {
                  id: c.cards[0].id,
                  scope: "personal",
                  changes: { nextStep: "Context verified" },
                }),
              ],
            },
          },
        ],
      },
    });
  });
  await page.goto("/#/personal/" + c.cards[0].id);
  await page.reload();
  await page
    .getByRole("button", { name: "Open assistant", exact: true })
    .click();
  const chat = page.locator("#wilo-assistant");
  await chat
    .getByLabel("Your message", { exact: true })
    .fill("Change its next step to Context verified");
  await chat.getByRole("button", { name: "Send", exact: true }).click();
  await expect(
    chat.getByRole("button", { name: "Apply changes", exact: true }),
  ).toBeVisible({ timeout: 15000 });
  expect(received).toBe(true);
  await expect(chat.locator(".assistant-screen-context")).toContainText(
    "Context card",
  );
  await chat
    .getByRole("button", { name: "Apply changes", exact: true })
    .click();
  await expect(chat).toContainText("Changes applied");
  await page
    .getByRole("button", { name: "Close assistant", exact: true })
    .click();
  await expect(
    page.locator('[data-project-id="' + c.cards[0].id + '"]'),
  ).toContainText("Context verified");
});

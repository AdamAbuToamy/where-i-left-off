// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, afterEach, it, vi, expect } from "vitest";
const fake = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock("../src/lib/pushNotifications", () => ({ pushCall: fake.call }));
import CardReminderControl from "../src/components/CardReminderControl";
const prefs = {
  enabled: true,
  due: true,
  stale: false,
  staleDays: 14,
  defaultTime: "09:00",
  leadMinutes: 0,
  quiet: true,
  quietStart: "22:00",
  quietEnd: "08:00",
  hideContent: true,
  timezone: "UTC",
  language: "en",
};
const scheduledAt = "2099-11-15T07:00:00.000Z",
  effectiveAt = "2099-11-15T08:00:00.000Z",
  version = "0".repeat(64);
const legacy = {
  id: "legacy",
  legacy: true,
  source: "legacy-explicit",
  status: "scheduled",
  state: "legacy",
  revision: null,
  settingsVersion: version,
  scheduledAt,
  effectiveAt,
  timeZone: "UTC",
  schedule: null,
  leadMinutes: 30,
  time: "07:00",
};
let node: HTMLElement,
  host: HTMLDivElement,
  root: ReturnType<typeof createRoot>,
  items: Array<Record<string, unknown>>;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  items = [
    legacy,
    ...[1, 2].map((n) => ({
      id: "r_" + n,
      revision: 0,
      source: "independent",
      state: "active",
      status: "scheduled",
      scheduledAt,
      effectiveAt,
      timeZone: "UTC",
      schedule: { mode: "absolute", scheduledAt, timeZone: "UTC" },
    })),
  ];
  fake.call.mockReset();
  fake.call.mockImplementation(async (d) => {
    if (d.action === "reminder-delete")
      items = items.map((x) =>
        x.id === d.reminderId
          ? { ...x, status: "cancelled", state: "cancelled" }
          : x,
      );
    if (d.action === "card-status")
      return { ...legacy, preferences: prefs, dueDate: "2099-11-18" };
    return {
      items,
      preferences: prefs,
      settingsVersion: version,
      cardDisabled: false,
    };
  });
  // jsdom lacks native dialog methods; browser journeys verify the real focus boundary.
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
  host = document.createElement("div");
  node = host;
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
async function render() {
  await act(async () =>
    root.render(
      <CardReminderControl
        id={"p".repeat(20)}
        name="Assignment2"
        language="en"
        compact
        initialOpen
      />,
    ),
  );
  node = document.querySelector<HTMLElement>("dialog.wilo-focus-dialog")!;
  expect(node).not.toBeNull();
}
it("renders legacy and independent entries together with the quiet-hours adjusted instant first", async () => {
  await render();
  expect(node.querySelectorAll(".card-reminder-item")).toHaveLength(3);
  expect(node.textContent).toContain("Existing explicit card reminder");
  expect(node.textContent).toContain("Independent reminder");
  expect(node.querySelector("time")?.dateTime).toBe(effectiveAt);
  expect(node.textContent).toContain("Original time before quiet hours");
});
it("cancels only the selected legacy entry using its settings version", async () => {
  await render();
  await act(async () =>
    [...node.querySelectorAll<HTMLButtonElement>(".card-reminder-item button")]
      .find((b) => b.textContent === "Cancel reminder")!
      .click(),
  );
  expect(fake.call).toHaveBeenCalledWith(
    expect.objectContaining({
      action: "reminder-delete",
      reminderId: "legacy",
      body: { expectedSettingsVersion: version },
    }),
  );
  expect(node.querySelectorAll(".card-reminder-item")).toHaveLength(3);
  expect(items.filter((x) => x.state === "active")).toHaveLength(2);
  expect(node.querySelector(".card-reminder-item")?.textContent).toContain(
    "Cancelled",
  );
});
it("labels an account fallback as superseded rather than presenting an extra scheduled reminder", async () => {
  items[0] = {
    ...legacy,
    source: "account-default",
    status: "superseded",
    suppressed: true,
  };
  await render();
  expect(node.textContent).toContain("Account default is superseded");
  expect(node.querySelector(".card-reminder-item")?.textContent).toContain(
    "Account default",
  );
});
it("editing old time-only settings starts with their actual lead time, not a fresh three-day default", async () => {
  await render();
  await act(async () =>
    node
      .querySelector<HTMLButtonElement>(".card-reminder-item button")!
      .click(),
  );
  const fields = [...node.querySelectorAll("label")];
  expect(
    fields
      .find((x) => x.textContent?.includes("How far before?"))
      ?.querySelector("input")?.value,
  ).toBe("30");
  expect(
    fields.find((x) => x.textContent?.includes("Unit"))?.querySelector("select")
      ?.value,
  ).toBe("minutes");
});

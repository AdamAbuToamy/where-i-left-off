// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { User } from "firebase/auth";
import { it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock("../src/lib/firebase", () => ({
  auth: { currentUser: { uid: "user-a" } },
  db: {},
}));
vi.mock("../src/lib/pushNotifications", () => ({ pushCall: mocks.call }));
vi.mock("../src/lib/groups", () => ({ watchGroups: () => () => {} }));
vi.mock("../src/lib/announcements", () => ({
  watchAnnouncements: () => () => {},
  lastRead: () => 0,
}));
import NotificationBell from "../src/components/NotificationBell";
it("shows a load failure without claiming an empty inbox and retries university history", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
  mocks.call.mockRejectedValue(new Error("network"));
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => {
      root.render(
        <NotificationBell user={{ uid: "user-a" } as User} language="en" />,
      );
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    await act(async () => {
      host.querySelector<HTMLButtonElement>("button")!.click();
    });
    expect(document.querySelector('[role="alert"]')?.textContent).toContain(
      "Could not refresh",
    );
    expect(document.querySelector(".notification-empty")).toBeNull();
    mocks.call.mockResolvedValue({
      items: [
        {
          id: "notice",
          title: "Assignment",
          body: "Due soon",
          url: "#/university?courseId=course-one",
          created_at: 1,
        },
      ],
      lastRead: 0,
      unread: 1,
      checkedAt: 2,
    });
    await act(async () => {
      [...document.querySelectorAll("button")]
        .find((b) => b.textContent === "Retry")!
        .click();
    });
    expect(document.querySelector('[role="alert"]')).toBeNull();
    expect(
      document.querySelector(".notification-item")?.getAttribute("href"),
    ).toBe("#/university?courseId=course-one");
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});

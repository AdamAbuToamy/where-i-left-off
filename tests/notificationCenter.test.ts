import { it, expect } from "vitest";
import { parseNotificationFeed } from "../src/lib/notificationCenter";
it("rejects unsafe navigation and oversized notification feeds", () => {
  const item = {
      id: "one",
      title: "Reminder",
      body: "Body",
      url: "#/personal/card-one",
      created_at: 1,
    },
    feed = { items: [item], lastRead: 0, unread: 1, checkedAt: 2 };
  expect(parseNotificationFeed(feed).items[0].url).toBe(item.url);
  for (const url of [
    "javascript:alert(1)",
    "https://example.com",
    "#/admin",
    "#/personal/../../settings",
  ])
    expect(() =>
      parseNotificationFeed({ ...feed, items: [{ ...item, url }] }),
    ).toThrow();
  expect(() =>
    parseNotificationFeed({ ...feed, items: Array(51).fill(item) }),
  ).toThrow();
});

it("accepts university notification links produced by the immediate Push pipeline", () => {
  const item = {
    id: "task_wilo-task-event",
    title: "Assignment",
    body: "Due soon",
    url: "#/university?courseId=course-123_abc",
    created_at: 1,
  };
  const feed = { items: [item], lastRead: 0, unread: 1, checkedAt: 2 };
  expect(parseNotificationFeed(feed).items[0].url).toBe(item.url);
  for (const url of [
    "#/university?courseId=",
    "#/university?courseId=../admin",
    "#/university?courseId=a&next=https://example.com",
    "#/university?courseId=%2Fadmin",
    "#/university?courseId=" + "a".repeat(101),
  ]) {
    expect(() =>
      parseNotificationFeed({ ...feed, items: [{ ...item, url }] }),
    ).toThrow();
  }
});

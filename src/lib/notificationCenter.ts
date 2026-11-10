export type NotificationItem = {
  id: string;
  title: string;
  body: string;
  url: string;
  created_at: number;
};
export type NotificationFeed = {
  items: NotificationItem[];
  lastRead: number;
  unread: number;
  checkedAt: number;
};
export function parseNotificationFeed(raw: unknown): NotificationFeed {
  const r = raw as NotificationFeed;
  if (
    !r ||
    !Array.isArray(r.items) ||
    r.items.length > 50 ||
    ![r.lastRead, r.unread, r.checkedAt].every(
      (n) => Number.isSafeInteger(n) && n >= 0,
    )
  )
    throw new Error("invalid-notifications");
  for (const item of r.items)
    if (
      !item ||
      typeof item.id !== "string" ||
      item.id.length > 100 ||
      typeof item.title !== "string" ||
      item.title.length > 100 ||
      typeof item.body !== "string" ||
      item.body.length > 1000 ||
      typeof item.url !== "string" ||
      !/^#\/(?:settings|notifications|university\?courseId=[-\w]{1,100}|personal\/[-\w]{1,100}|groups\/[A-Za-z0-9]{20}(?:\/[-\w]{1,100})?)$/.test(
        item.url,
      ) ||
      !Number.isSafeInteger(item.created_at) ||
      item.created_at < 0
    )
      throw new Error("invalid-notifications");
  return r;
}

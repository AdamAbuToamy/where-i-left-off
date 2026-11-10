import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bell, CheckCheck, Settings, X } from "lucide-react";
import type { User } from "firebase/auth";
import type { Language } from "../translations";
import { auth, db } from "../lib/firebase";
import { pushCall } from "../lib/pushNotifications";
import { parseNotificationFeed } from "../lib/notificationCenter";
import type { NotificationFeed } from "../lib/notificationCenter";
import { watchGroups } from "../lib/groups";
import { watchAnnouncements, lastRead } from "../lib/announcements";
import type { Announcement } from "../lib/announcements";
import "./NotificationBell.css";
type GroupNotice = Announcement & { groupId: string; groupName: string };
const words = {
  ar: {
    title: "الإشعارات",
    close: "إغلاق الإشعارات",
    settings: "إعدادات التنبيهات",
    all: "تعليم الكل كمقروء",
    empty: "لا توجد إشعارات بعد",
    hint: "ستجد هنا التذكيرات الجديدة وإعلانات مجموعاتك.",
    enable: "تفعيل إشعارات الهاتف",
    error: "تعذّر تحديث الإشعارات.",
    retry: "إعادة المحاولة",
    loading: "جارٍ التحديث…",
    read: "مقروء",
    new: "جديد",
  },
  en: {
    title: "Notifications",
    close: "Close notifications",
    settings: "Notification settings",
    all: "Mark all as read",
    empty: "No notifications yet",
    hint: "New reminders and group announcements appear here.",
    enable: "Enable phone notifications",
    error: "Could not refresh notifications.",
    retry: "Retry",
    loading: "Refreshing…",
    read: "Read",
    new: "New",
  },
  he: {
    title: "התראות",
    close: "סגירת התראות",
    settings: "הגדרות התראות",
    all: "סימון הכל כנקרא",
    empty: "אין התראות עדיין",
    hint: "תזכורות חדשות והודעות קבוצות יופיעו כאן.",
    enable: "הפעלת התראות בטלפון",
    error: "לא ניתן לרענן התראות.",
    retry: "ניסיון נוסף",
    loading: "מרענן…",
    read: "נקרא",
    new: "חדש",
  },
};
export default function NotificationBell({
  user,
  language,
}: {
  user: User;
  language: Language;
}) {
  const t = words[language],
    uid = user.uid,
    [open, setOpen] = useState(false),
    [feed, setFeed] = useState<NotificationFeed | null>(null),
    [groups, setGroups] = useState<GroupNotice[]>([]),
    [error, setError] = useState(false),
    [loading, setLoading] = useState(false),
    [marking, setMarking] = useState(false),
    busy = useRef(false),
    checked = useRef(0),
    alive = useRef(false),
    trigger = useRef<HTMLButtonElement>(null),
    dialog = useRef<HTMLDialogElement>(null);
  const refresh = useCallback(
    async (force = false) => {
      if (
        busy.current ||
        !navigator.onLine ||
        (!force && Date.now() - checked.current < 60000)
      )
        return;
      busy.current = true;
      setLoading(true);
      try {
        const next = parseNotificationFeed(
          await pushCall({ action: "notifications" }),
        );
        if (alive.current && auth?.currentUser?.uid === uid) {
          setFeed(next);
          checked.current = Date.now();
          setError(false);
        }
      } catch {
        if (alive.current) setError(true);
      } finally {
        busy.current = false;
        if (alive.current) setLoading(false);
      }
    },
    [uid],
  );
  useEffect(() => {
    alive.current = true;
    const startup = setTimeout(() => void refresh(), 0);
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") void refresh(true);
    }, 60000);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const focus = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const message = (e: MessageEvent) => {
      if (e.data?.type === "wilo-notification" && e.data.uid === uid) {
        clearTimeout(timer);
        timer = setTimeout(() => void refresh(true), 1000);
      }
    };
    window.addEventListener("focus", focus);
    window.addEventListener("online", focus);
    document.addEventListener("visibilitychange", focus);
    navigator.serviceWorker?.addEventListener("message", message);
    return () => {
      alive.current = false;
      clearTimeout(startup);
      clearInterval(interval);
      clearTimeout(timer);
      window.removeEventListener("focus", focus);
      window.removeEventListener("online", focus);
      document.removeEventListener("visibilitychange", focus);
      navigator.serviceWorker?.removeEventListener("message", message);
    };
  }, [uid, refresh]);
  useEffect(() => {
    const feeds = new Map<string, GroupNotice[]>(),
      stops = new Map<string, () => void>();
    let active = true;
    const publish = () => {
      if (active) setGroups([...feeds.values()].flat());
    };
    const stop = watchGroups(
      db!,
      uid,
      (items, cached) => {
        if (cached) return;
        for (const [id, cleanup] of stops)
          if (!items.some((g) => g.id === id)) {
            cleanup();
            stops.delete(id);
            feeds.delete(id);
          }
        for (const group of items)
          if (!stops.has(group.id))
            stops.set(
              group.id,
              watchAnnouncements(
                group.id,
                (notices) => {
                  feeds.set(
                    group.id,
                    notices.map((n) => ({
                      ...n,
                      groupId: group.id,
                      groupName: group.name,
                    })),
                  );
                  publish();
                },
                () => {
                  feeds.delete(group.id);
                  publish();
                  setError(true);
                },
                5,
              ),
            );
        publish();
      },
      () => {
        if (active) setError(true);
      },
    );
    return () => {
      active = false;
      stop();
      stops.forEach((stop) => stop());
    };
  }, [uid]);
  useEffect(() => {
    if (!open) return;
    const el = dialog.current!;
    el.showModal();
    return () => el.close();
  }, [open]);
  const notices = [
    ...(feed?.items || []),
    ...groups.map((n) => ({
      id: "group_" + n.groupId + "_" + n.id,
      title: n.groupName + ": " + n.title,
      body: n.body,
      url: "#/groups/" + n.groupId,
      created_at: n.createdAt?.toMillis() || 0,
      groupId: n.groupId,
    })),
  ]
    .sort((a, b) => b.created_at - a.created_at)
    .slice(0, 50);
  const isUnread = (n: (typeof notices)[number]) =>
    n.created_at >
    Math.max(
      feed?.lastRead || 0,
      "groupId" in n ? lastRead(uid, n.groupId as string) : 0,
    );
  const count =
      (feed?.unread || 0) +
      groups.filter(
        (n) =>
          (n.createdAt?.toMillis() || 0) >
          Math.max(feed?.lastRead || 0, lastRead(uid, n.groupId)),
      ).length,
    close = () => {
      setOpen(false);
      trigger.current?.focus();
    };
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="notification-bell"
        aria-label={t.title}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => {
          setOpen(true);
          void refresh(true);
        }}
      >
        <Bell size={21} />
        {count > 0 && (
          <span className="notification-badge" aria-label={String(count)}>
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>
      {open &&
        createPortal(
          <dialog
            ref={dialog}
            className="notification-center"
            dir={language === "en" ? "ltr" : "rtl"}
            aria-label={t.title}
            onCancel={(e) => {
              e.preventDefault();
              close();
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) close();
            }}
          >
            <div className="notification-content">
              <header>
                <h2>{t.title}</h2>
                <a
                  href="#/notifications"
                  aria-label={t.settings}
                  onClick={close}
                >
                  <Settings size={19} />
                </a>
                <button type="button" aria-label={t.close} onClick={close}>
                  <X size={20} />
                </button>
              </header>
              <div className="notification-toolbar">
                <a
                  className="notification-mobile-enable"
                  href="#/notifications"
                  onClick={close}
                >
                  {t.enable}
                </a>
                <button
                  type="button"
                  disabled={!feed || !count || marking}
                  onClick={() => {
                    if (!feed || marking) return;
                    setMarking(true);
                    void pushCall({
                      action: "notifications-read",
                      through: feed.checkedAt,
                    })
                      .then(() => {
                        if (alive.current)
                          setFeed((previous) =>
                            previous
                              ? {
                                  ...previous,
                                  lastRead: feed.checkedAt,
                                  unread: 0,
                                }
                              : previous,
                          );
                      })
                      .catch(() => setError(true))
                      .finally(() => {
                        if (alive.current) setMarking(false);
                      });
                  }}
                >
                  <CheckCheck size={16} />
                  {t.all}
                </button>
              </div>
              {loading && <small role="status">{t.loading}</small>}
              {error && (
                <p role="alert">
                  {t.error}{" "}
                  <button onClick={() => void refresh(true)}>{t.retry}</button>
                </p>
              )}
              <div className="notification-list">
                {!notices.length && !loading && !error && (
                  <div className="notification-empty">
                    <Bell size={30} />
                    <strong>{t.empty}</strong>
                    <p>{t.hint}</p>
                  </div>
                )}
                {notices.map((n) => (
                  <a
                    className={
                      "notification-item " + (isUnread(n) ? "is-unread" : "")
                    }
                    key={n.id}
                    href={n.url}
                    onClick={close}
                  >
                    <span
                      className="notification-dot"
                      aria-label={isUnread(n) ? t.new : t.read}
                    />
                    <div>
                      <strong dir="auto">{n.title}</strong>
                      <p dir="auto">{n.body}</p>
                      <time dateTime={new Date(n.created_at).toISOString()}>
                        {new Date(n.created_at).toLocaleString(language)}
                      </time>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </dialog>,
          document.body,
        )}
    </>
  );
}

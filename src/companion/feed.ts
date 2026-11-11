import { useEffect } from "react";
import type { CompanionItem } from "./policy";
export const companionFeedEvent = "wilo-companion-feed";
export function useCompanionFeed(
  uid: string,
  scope: string,
  items: readonly CompanionItem[],
) {
  useEffect(() => {
    const publish = () =>
      window.dispatchEvent(
        new CustomEvent(companionFeedEvent, { detail: { uid, scope, items } }),
      );
    const request = (event: Event) => {
      if ((event as CustomEvent).detail?.uid === uid) publish();
    };
    publish();
    window.addEventListener("wilo-companion-request", request);
    return () => {
      window.removeEventListener("wilo-companion-request", request);
      window.dispatchEvent(
        new CustomEvent(companionFeedEvent, {
          detail: { uid, scope, items: [] },
        }),
      );
    };
  }, [uid, scope, items]);
}
export function safeCompanionItems(value: unknown): CompanionItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, 5000)
    .filter(
      (x): x is CompanionItem =>
        !!x &&
        ["card", "course", "task"].includes(x.kind) &&
        typeof x.id === "string" &&
        x.id.length > 0 &&
        x.id.length <= 128 &&
        typeof x.title === "string" &&
        x.title.trim().length > 0 &&
        x.title.length <= 300 &&
        (x.dueAt === undefined ||
          (typeof x.dueAt === "number" && Number.isFinite(x.dueAt))) &&
        (x.kind !== "task" ||
          (typeof x.courseId === "string" && x.courseId.length <= 128)),
    );
}

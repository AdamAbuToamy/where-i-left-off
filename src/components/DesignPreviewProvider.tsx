import { useLayoutEffect, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import type { User } from "firebase/auth";
import { isAdmin } from "../lib/admin";
import { DesignPreviewContext } from "./designPreviewContext";
import "./designPreview.css";

/** Published visual design. Only administrators can change their local fallback preference. */
export default function DesignPreviewProvider({
  user,
  children,
}: {
  user: User | null;
  children: ReactNode;
}) {
  const available = !!user && isAdmin(user.email, user.emailVerified);
  const [choice, setChoice] = useState<{ uid: string; value: boolean } | null>(
    null,
  );
  const stored = useSyncExternalStore(
    (listener) => {
      window.addEventListener("wilo-design-preview-changed", listener);
      window.addEventListener("storage", listener);
      return () => {
        window.removeEventListener("wilo-design-preview-changed", listener);
        window.removeEventListener("storage", listener);
      };
    },
    () => {
      try {
        return user
          ? localStorage.getItem("wilo-design-preview:" + user.uid)
          : null;
      } catch {
        return null;
      }
    },
    () => null,
  );
  const enabled =
    !!user && (choice?.uid === user.uid ? choice.value : stored !== "off");
  useLayoutEffect(() => {
    if (enabled) document.documentElement.dataset.designPreview = "on";
    else delete document.documentElement.dataset.designPreview;
    return () => {
      delete document.documentElement.dataset.designPreview;
    };
  }, [enabled]);
  function setEnabled(value: boolean) {
    if (!available || !user) return;
    setChoice({ uid: user.uid, value });
    try {
      localStorage.setItem(
        "wilo-design-preview:" + user.uid,
        value ? "on" : "off",
      );
    } catch {
      /* Remains active for this session. */
    }
  }
  return (
    <DesignPreviewContext value={{ enabled, available, setEnabled }}>
      {children}
    </DesignPreviewContext>
  );
}

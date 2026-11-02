import { useLayoutEffect } from "react";
import type { ReactNode } from "react";
import type { User } from "firebase/auth";
import { DesignPreviewContext } from "./designPreviewContext";
import "./designPreview.css";
/** One final account design; legacy device choices no longer select an alternate UI. */
export default function DesignPreviewProvider({
  user,
  children,
}: {
  user: User | null;
  children: ReactNode;
}) {
  const enabled = !!user;
  useLayoutEffect(() => {
    if (enabled) document.documentElement.dataset.designPreview = "on";
    else delete document.documentElement.dataset.designPreview;
    if (user) {
      try {
        localStorage.removeItem("wilo-design-preview:" + user.uid);
      } catch {
        /* An obsolete preference must never block the final design. */
      }
    }
    return () => {
      delete document.documentElement.dataset.designPreview;
    };
  }, [enabled, user]);
  return (
    <DesignPreviewContext value={{ enabled }}>{children}</DesignPreviewContext>
  );
}

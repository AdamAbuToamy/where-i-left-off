import { useLayoutEffect } from "react";
import type { ReactNode } from "react";
import type { User } from "firebase/auth";
import { DesignPreviewContext } from "./designPreviewContext";
import "./designPreview.css";
import { isAdmin } from "../lib/admin";
import "./kitchenStudy.css";
/** One final account design; legacy device choices no longer select an alternate UI. */
export default function DesignPreviewProvider({
  user,
  children,
}: {
  user: User | null;
  children: ReactNode;
}) {
  const enabled = !!user;
  const kitchenStudy = isAdmin(user?.email, user?.emailVerified);
  useLayoutEffect(() => {
    if (kitchenStudy) document.documentElement.dataset.kitchenStudy = "on";
    else delete document.documentElement.dataset.kitchenStudy;
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
      delete document.documentElement.dataset.kitchenStudy;
    };
  }, [enabled, kitchenStudy, user]);
  return (
    <DesignPreviewContext value={{ enabled, kitchenStudy }}>
      {children}
    </DesignPreviewContext>
  );
}

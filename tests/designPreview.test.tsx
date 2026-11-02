// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { User } from "firebase/auth";
import { it, expect, vi, afterEach } from "vitest";
import DesignPreviewProvider from "../src/components/DesignPreviewProvider";
import PreviewDetails from "../src/components/PreviewDetails";
const admin = {
  uid: "admin-preview",
  email: "adam2002hosny@gmail.com",
  emailVerified: true,
} as User;
afterEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.designPreview;
  vi.unstubAllGlobals();
});
it("enables the published design for normal users without granting design administration", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const element = document.createElement("div"),
    root = createRoot(element);
  const regular = {
    uid: "ordinary",
    email: "other@example.test",
    emailVerified: true,
  } as User;
  localStorage.setItem("wilo-design-preview:ordinary", "off");
  try {
    await act(async () =>
      root.render(
        <DesignPreviewProvider user={regular}>
          <PreviewDetails>
            <p>Original content</p>
          </PreviewDetails>
        </DesignPreviewProvider>,
      ),
    );
    expect(element.textContent).toContain("Original content");
    expect(element.querySelector(".design-preview-switch")).toBeNull();
    expect(element.querySelector(".preview-disclosure")).not.toBeNull();
    expect(document.documentElement.dataset.designPreview).toBe("on");
  } finally {
    await act(async () => root.unmount());
  }
});
it("keeps the final design enabled for an admin with a legacy off preference and preserves hidden edits", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const element = document.createElement("div"),
    root = createRoot(element);
  localStorage.setItem("wilo-design-preview:" + admin.uid, "off");
  try {
    await act(async () =>
      root.render(
        <DesignPreviewProvider user={admin}>
          <PreviewDetails language="en">
            <input defaultValue="Unsaved note" />
          </PreviewDetails>
        </DesignPreviewProvider>,
      ),
    );
    expect(document.documentElement.dataset.designPreview).toBe("on");
    const toggle = element.querySelector<HTMLButtonElement>(
        ".preview-disclosure-toggle",
      )!,
      field = element.querySelector("input")!;
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(
      element.querySelector(".preview-disclosure-body")?.hasAttribute("inert"),
    ).toBe(true);
    await act(async () => toggle.click());
    field.value = "Keep my edit";
    await act(async () => toggle.click());
    await act(async () => toggle.click());
    expect(element.querySelector("input")).toBe(field);
    expect(field.value).toBe("Keep my edit");
    expect(document.documentElement.dataset.designPreview).toBe("on");
    expect(element.querySelector(".design-preview-switch")).toBeNull();
    expect(localStorage.getItem("wilo-design-preview:" + admin.uid)).toBeNull();
  } finally {
    await act(async () => root.unmount());
  }
});
it("removes the visual attribute on sign-out", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  localStorage.setItem("wilo-design-preview:" + admin.uid, "on");
  const element = document.createElement("div"),
    root = createRoot(element);
  localStorage.setItem("wilo-design-preview:" + admin.uid, "off");
  try {
    await act(async () =>
      root.render(
        <DesignPreviewProvider user={admin}>
          <p>Account</p>
        </DesignPreviewProvider>,
      ),
    );
    expect(document.documentElement.dataset.designPreview).toBe("on");
    await act(async () =>
      root.render(
        <DesignPreviewProvider user={null}>
          <p>Signed out</p>
        </DesignPreviewProvider>,
      ),
    );
    expect(document.documentElement.dataset.designPreview).toBeUndefined();
  } finally {
    await act(async () => root.unmount());
  }
});

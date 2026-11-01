// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { User } from "firebase/auth";
import { it, expect, vi, afterEach } from "vitest";
import DesignPreviewProvider from "../src/components/DesignPreviewProvider";
import PreviewDetails, {
  DesignPreviewSwitch,
} from "../src/components/PreviewDetails";
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
it("requires verified admin even when a normal user has the opt-in key", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const element = document.createElement("div"),
    root = createRoot(element);
  const regular = {
    uid: "ordinary",
    email: "other@example.test",
    emailVerified: true,
  } as User;
  localStorage.setItem("wilo-design-preview:ordinary", "on");
  try {
    await act(async () =>
      root.render(
        <DesignPreviewProvider user={regular}>
          <DesignPreviewSwitch language="en" />
          <PreviewDetails>
            <p>Original content</p>
          </PreviewDetails>
        </DesignPreviewProvider>,
      ),
    );
    expect(element.textContent).toBe("Original content");
    expect(element.querySelector("button")).toBeNull();
    expect(document.documentElement.dataset.designPreview).toBeUndefined();
  } finally {
    await act(async () => root.unmount());
  }
});
it("allows admin preview, preserves hidden fields and restores original content without changing data", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const element = document.createElement("div"),
    root = createRoot(element);
  try {
    await act(async () =>
      root.render(
        <DesignPreviewProvider user={admin}>
          <DesignPreviewSwitch language="en" />
          <PreviewDetails language="en">
            <input defaultValue="Unsaved note" />
          </PreviewDetails>
        </DesignPreviewProvider>,
      ),
    );
    await act(async () => element.querySelector("button")!.click());
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
    await act(async () =>
      element
        .querySelector<HTMLButtonElement>(".design-preview-switch button")!
        .click(),
    );
    expect(document.documentElement.dataset.designPreview).toBeUndefined();
    expect(element.querySelector(".preview-disclosure")).toBeNull();
  } finally {
    await act(async () => root.unmount());
  }
});
it("removes the visual attribute when switching away from the admin account", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  localStorage.setItem("wilo-design-preview:" + admin.uid, "on");
  const element = document.createElement("div"),
    root = createRoot(element);
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

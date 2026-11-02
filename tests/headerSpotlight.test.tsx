// @vitest-environment jsdom
import { act } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { it, expect, vi, afterEach, beforeEach } from "vitest";
const mode = vi.hoisted(() => ({ reduced: false }));
vi.mock("motion/react", () => ({
  useReducedMotion: () => mode.reduced,
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
  motion: {
    div: ({
      children,
      className,
      "data-face": face,
    }: {
      children: ReactNode;
      className: string;
      "data-face": string;
    }) => (
      <div className={className} data-face={face}>
        {children}
      </div>
    ),
  },
}));
import HeaderSpotlight from "../src/components/HeaderSpotlight";
import { DesignPreviewContext } from "../src/components/designPreviewContext";
beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({
    matches: mode.reduced,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  mode.reduced = false;
  localStorage.clear();
});
it("automatically completes the cycle without a play control or hover dependency", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        Response.json({ extensionId: "a".repeat(32), published: true }),
      ),
  );
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Chrome/140.0");
  const element = document.createElement("div"),
    root = createRoot(element);
  try {
    await act(async () =>
      root.render(
        <DesignPreviewContext
          value={{ enabled: true }}
        >
          <HeaderSpotlight brand="WILO" language="en" installed={false} />
        </DesignPreviewContext>,
      ),
    );
    expect(element.querySelector(".brand-motion-toggle")).toBeNull();
    expect(
      element.querySelector("[data-face]")?.getAttribute("data-face"),
    ).toBe("brand");
    await act(async () => vi.advanceTimersByTime(15000));
    expect(
      element.querySelector("[data-face]")?.getAttribute("data-face"),
    ).toBe("app");
    await act(async () => vi.advanceTimersByTime(5000));
    expect(
      element.querySelector("[data-face]")?.getAttribute("data-face"),
    ).toBe("brand");
    await act(async () => vi.advanceTimersByTime(15000));
    expect(
      element.querySelector("[data-face]")?.getAttribute("data-face"),
    ).toBe("chrome");
    expect(
      element.querySelector(".brand-promotion")?.getAttribute("href"),
    ).toBe("https://chromewebstore.google.com/detail/" + "a".repeat(32));
  } finally {
    await act(async () => root.unmount());
  }
});

it("keeps ordinary users unchanged and automatically updates reduced-motion text", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const fetch = vi.fn().mockResolvedValue(Response.json({}));
  vi.stubGlobal("fetch", fetch);
  const element = document.createElement("div"),
    root = createRoot(element);
  try {
    await act(async () =>
      root.render(
        <HeaderSpotlight brand="WILO" language="ar" installed={false} />,
      ),
    );
    expect(element.innerHTML).toBe("<h1>WILO</h1>");
    expect(fetch).not.toHaveBeenCalled();
    mode.reduced = true;
    await act(async () =>
      root.render(
        <DesignPreviewContext
          value={{ enabled: true }}
        >
          <HeaderSpotlight brand="WILO" language="ar" installed={false} />
        </DesignPreviewContext>,
      ),
    );
    await act(async () => vi.advanceTimersByTime(15000));
    expect(
      element.querySelector("[data-face]")?.getAttribute("data-face"),
    ).toBe("app");
    expect(element.querySelector(".brand-motion-toggle")).toBeNull();
  } finally {
    await act(async () => root.unmount());
  }
});

it("continues automatic rotation when the app is already installed and no extension offer exists", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(Response.json({ published: false })),
  );
  const element = document.createElement("div"),
    root = createRoot(element);
  try {
    await act(async () =>
      root.render(
        <DesignPreviewContext
          value={{ enabled: true }}
        >
          <HeaderSpotlight brand="WILO" language="en" installed={true} />
        </DesignPreviewContext>,
      ),
    );
    await act(async () => vi.advanceTimersByTime(15000));
    expect(
      element.querySelector("[data-face]")?.getAttribute("data-face"),
    ).toBe("app");
    expect(element.textContent).toContain("Installed on your device");
    expect(element.textContent).not.toContain("Install the app");
    expect(element.querySelector(".brand-motion-toggle")).toBeNull();
  } finally {
    await act(async () => root.unmount());
  }
});

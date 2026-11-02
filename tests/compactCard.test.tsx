// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { it, expect, vi } from "vitest";
import CompactCardShell from "../src/components/CompactCardShell";
import { DesignPreviewContext } from "../src/components/designPreviewContext";
import { ProjectEntity } from "../src/lib/projectEntity";
it("keeps full content available after collapse and expands without changing the project", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const element = document.createElement("div"),
    root = createRoot(element),
    project = ProjectEntity.create(
      "card",
      "Compact card",
      "Next step",
      100,
      {},
      1,
    ).snapshot(),
    before = structuredClone(project);
  try {
    await act(async () =>
      root.render(
        <DesignPreviewContext
          value={{ enabled: true }}
        >
          <CompactCardShell project={project} sections={[]} language="en">
            <input defaultValue="Retain edit" />
            <button>Existing action</button>
          </CompactCardShell>
        </DesignPreviewContext>,
      ),
    );
    const content = element.querySelector<HTMLElement>(".envelope-content")!;
    expect(content.hidden).toBe(true);
    expect(content.hasAttribute("inert")).toBe(true);
    await act(async () =>
      element.querySelector<HTMLButtonElement>(".envelope-expand")!.click(),
    );
    expect(content.hidden).toBe(false);
    const input = element.querySelector("input")!;
    input.value = "Unsent value";
    await act(async () =>
      element.querySelector<HTMLButtonElement>(".envelope-collapse")!.click(),
    );
    await act(async () =>
      element.querySelector<HTMLButtonElement>(".envelope-expand")!.click(),
    );
    expect(element.querySelector("input")).toBe(input);
    expect(input.value).toBe("Unsent value");
    expect(project).toEqual(before);
  } finally {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
  }
});
it("preserves the original markup when admin preview is disabled", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const element = document.createElement("div"),
    root = createRoot(element),
    project = ProjectEntity.create("card", "Card", "Step", 0, {}, 1).snapshot();
  try {
    await act(async () =>
      root.render(
        <CompactCardShell project={project} sections={[]} language="en">
          <p>Original actions</p>
        </CompactCardShell>,
      ),
    );
    expect(element.innerHTML).toBe("<p>Original actions</p>");
  } finally {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
  }
});

// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
vi.mock("../src/components/CatalogLookup", () => ({ default: () => null }));
import NewProjectForm from "../src/components/NewProjectForm";
it("locks duplicate submissions, shows feedback on desktop and preserves entries after a failure", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const element = document.createElement("div"),
    root = createRoot(element);
  document.body.append(element);
  let reject: (error: Error) => void = () => {};
  const add = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<boolean>((_, no) => {
          reject = no;
        }),
    )
    .mockResolvedValueOnce(true);
  try {
    await act(async () =>
      root.render(
        <NewProjectForm language="en" isOpen onAdd={add} onCancel={() => {}} />,
      ),
    );
    const name = element.querySelector<HTMLInputElement>("#project-name")!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!.call(name, "My project");
      name.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const submit = () =>
      element
        .querySelector("form")!
        .dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        );
    await act(async () => {
      submit();
      submit();
    });
    expect(add).toHaveBeenCalledTimes(1);
    expect(element.querySelector("form")?.getAttribute("aria-busy")).toBe(
      "true",
    );
    expect(element.querySelector('button[type="submit"]')?.textContent).toBe(
      "Saving…",
    );
    await act(async () => reject(new Error("offline")));
    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      "Your entries are kept here",
    );
    expect(name.value).toBe("My project");
    await act(async () => submit());
    expect(add).toHaveBeenCalledTimes(2);
    expect(name.value).toBe("");
    expect(element.querySelector('[role="alert"]')).toBeNull();
  } finally {
    act(() => root.unmount());
    element.remove();
    vi.unstubAllGlobals();
  }
});

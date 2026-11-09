// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import ApiDocumentation from "../src/apiDocs/ApiDocumentation";
import {
  operations,
  requestCode,
  operationBody,
  placeholder,
  workflowCode,
  apiBase,
} from "../src/apiDocs/contract";
import { route } from "../src/lib/navigation";
let root: Root, container: HTMLDivElement;
const copy = vi.fn();
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: copy.mockReset().mockResolvedValue(undefined) },
  });
  Element.prototype.scrollIntoView = vi.fn();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => root.render(<ApiDocumentation language="en" />));
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
it("routes publicly and exposes every operation and scope from the actual contract", () => {
  expect(route("#/api-docs").page).toBe("api-docs");
  expect(container.querySelectorAll(".api-doc-operation")).toHaveLength(
    operations.length,
  );
  for (const op of operations) {
    expect(container.textContent).toContain(op.path);
    for (const scope of op.scopes)
      expect(container.textContent).toContain(scope);
  }
  expect(container.querySelector("a[download]")?.getAttribute("href")).toBe(
    "/openapi-public-api.json",
  );
  expect(container.querySelectorAll("input")).toHaveLength(1);
  expect(container.querySelector("input")?.type).toBe("search");
});
it("copies the exact selected example, handles clipboard rejection, and never asks for a key", async () => {
  const select = container.querySelector("select")!;
  act(() => {
    select.value = "python";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  const button = container.querySelector<HTMLButtonElement>(
    ".api-doc-code button",
  )!;
  await act(async () => button.click());
  expect(copy).toHaveBeenCalledWith(
    requestCode(
      operations.find((o) => o.operationId === "listCourses")!,
      "python",
    ),
  );
  expect(copy.mock.calls[0][0]).toContain(placeholder);
  copy.mockRejectedValue(Error("unavailable"));
  await act(async () => button.click());
  expect(container.textContent).toContain("Copy failed");
});
it("filters operations by scopes and focuses the chosen navigation section", () => {
  const input =
    container.querySelector<HTMLInputElement>("input[type=search]")!;
  act(() => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, "tasks:write");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(container.querySelectorAll(".api-doc-operation")).toHaveLength(
    operations.filter((o) => o.scopes.includes("tasks:write")).length,
  );
  act(() => {
    [...container.querySelectorAll<HTMLButtonElement>("nav button")]
      .find((b) => b.textContent === "Errors and retries")!
      .click();
  });
  expect(document.activeElement?.id).toBe("api-doc-errors");
});
it("generates meaningful updates and declares idempotency only where contract requires it", () => {
  for (const op of operations) {
    const body = operationBody(op) as
      | { values?: Record<string, unknown>; expectedRevision?: number }
      | undefined;
    if (op.method === "PATCH" && body?.values)
      expect(Object.keys(body.values).length).toBeGreaterThan(0);
    for (const language of ["curl", "python", "javascript"] as const) {
      const code = requestCode(op, language);
      expect(code).toContain(apiBase);
      expect(code).toContain(placeholder);
      expect(code.includes("Idempotency-Key")).toBe(
        op.parameters.some((p) => p.name === "Idempotency-Key"),
      );
    }
  }
  expect(workflowCode("python")).toContain("course_id");
});

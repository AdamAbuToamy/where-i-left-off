// @vitest-environment jsdom
import { it, expect, vi } from "vitest";
import { revealJourneyTarget } from "../src/components/journeyScroll";
const view = { top: 0, left: 0, width: 390, height: 800 };
function rect(top: number, height = 44) {
  return {
    top,
    bottom: top + height,
    left: 20,
    right: 300,
    width: 280,
    height,
    x: 20,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
}
it("reveals offscreen controls and leaves already visible targets alone", () => {
  const node = document.createElement("button");
  node.scrollIntoView = vi.fn();
  node.getBoundingClientRect = () => rect(1100);
  expect(revealJourneyTarget(node, view)).toBe(true);
  expect(node.scrollIntoView).toHaveBeenCalledWith({
    block: "center",
    inline: "nearest",
    behavior: "instant",
  });
  vi.mocked(node.scrollIntoView).mockClear();
  node.getBoundingClientRect = () => rect(200);
  expect(revealJourneyTarget(node, view)).toBe(false);
  expect(node.scrollIntoView).not.toHaveBeenCalled();
});
it("reveals controls clipped by a nested card scroller", () => {
  const host = document.createElement("div"),
    node = document.createElement("button");
  host.style.overflowY = "auto";
  host.append(node);
  document.body.append(host);
  Object.defineProperty(host, "clientHeight", { value: 300 });
  Object.defineProperty(host, "clientWidth", { value: 350 });
  host.getBoundingClientRect = () => ({
    ...rect(50, 300),
    left: 0,
    right: 350,
    width: 350,
  });
  node.getBoundingClientRect = () => rect(450);
  node.scrollIntoView = vi.fn();
  try {
    expect(revealJourneyTarget(node, view)).toBe(true);
    expect(node.scrollIntoView).toHaveBeenCalledOnce();
  } finally {
    host.remove();
  }
});
it("shows the beginning of an oversized page introduction", () => {
  const node = document.createElement("section");
  node.getBoundingClientRect = () => rect(-500, 1800);
  node.scrollIntoView = vi.fn();
  revealJourneyTarget(node, view);
  expect(node.scrollIntoView).toHaveBeenCalledWith({
    block: "start",
    inline: "nearest",
    behavior: "instant",
  });
});

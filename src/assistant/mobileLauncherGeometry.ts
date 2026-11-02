export type Edge = "left" | "right" | "top" | "bottom";
export type Dock = { edge: Edge; ratio: number };
export type Point = { x: number; y: number };
export type SafeArea = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};
export type LauncherBounds = {
  width: number;
  height: number;
  buttonWidth: number;
  buttonHeight: number;
  inset?: number;
  safeArea?: SafeArea;
};
function limits(bounds: LauncherBounds) {
  const margin = bounds.inset ?? 12,
    minX = margin + (bounds.safeArea?.left || 0),
    minY = margin + (bounds.safeArea?.top || 0);
  return {
    minX,
    minY,
    maxX: Math.max(
      minX,
      bounds.width -
        bounds.buttonWidth -
        margin -
        (bounds.safeArea?.right || 0),
    ),
    maxY: Math.max(
      minY,
      bounds.height -
        bounds.buttonHeight -
        margin -
        (bounds.safeArea?.bottom || 0),
    ),
  };
}
export function clampLauncher(point: Point, bounds: LauncherBounds): Point {
  const { minX, minY, maxX, maxY } = limits(bounds);
  return {
    x: Math.max(minX, Math.min(maxX, point.x)),
    y: Math.max(minY, Math.min(maxY, point.y)),
  };
}
export function dockAtEdge(
  edge: Edge,
  point: Point,
  bounds: LauncherBounds,
): Dock {
  const p = clampLauncher(point, bounds),
    { minX, minY, maxX, maxY } = limits(bounds);
  return {
    edge,
    ratio:
      edge === "left" || edge === "right"
        ? (p.y - minY) / (maxY - minY || 1)
        : (p.x - minX) / (maxX - minX || 1),
  };
}
export function positionForDock(dock: Dock, bounds: LauncherBounds): Point {
  const { minX, minY, maxX, maxY } = limits(bounds),
    ratio = Math.max(0, Math.min(1, dock.ratio));
  return {
    x:
      dock.edge === "left"
        ? minX
        : dock.edge === "right"
          ? maxX
          : minX + (maxX - minX) * ratio,
    y:
      dock.edge === "top"
        ? minY
        : dock.edge === "bottom"
          ? maxY
          : minY + (maxY - minY) * ratio,
  };
}
export function snapLauncher(point: Point, bounds: LauncherBounds): Dock {
  const p = clampLauncher(point, bounds),
    { minX, minY, maxX, maxY } = limits(bounds);
  const candidates: [Edge, number][] = [
    ["left", p.x - minX],
    ["right", maxX - p.x],
    ["top", p.y - minY],
    ["bottom", maxY - p.y],
  ];
  const edge = candidates.reduce((best, item) =>
    item[1] < best[1] ? item : best,
  )[0];
  return dockAtEdge(edge, p, bounds);
}
export function validDock(value: unknown): value is Dock {
  return (
    !!value &&
    typeof value === "object" &&
    "edge" in value &&
    ["left", "right", "top", "bottom"].includes(String(value.edge)) &&
    "ratio" in value &&
    typeof value.ratio === "number" &&
    Number.isFinite(value.ratio) &&
    value.ratio >= 0 &&
    value.ratio <= 1
  );
}

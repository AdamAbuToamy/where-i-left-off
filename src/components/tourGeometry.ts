export type TourRect = { x: number; y: number; width: number; height: number };
/** Clip the guide outline to the visible viewport; never create horizontal overflow. */
export function journeyFocusRect(
  target: TourRect | null,
  viewport: { width: number; height: number },
): TourRect | null {
  if (!target || !target.width || !target.height) return null;
  const x = Math.max(8, target.x - 5),
    y = Math.max(8, target.y - 5),
    right = Math.min(target.x + target.width + 5, viewport.width - 8),
    bottom = Math.min(target.y + target.height + 5, viewport.height - 8);
  return right > x && bottom > y
    ? { x, y, width: right - x, height: bottom - y }
    : null;
}

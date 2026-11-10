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

/** Place a travelling companion next to the target, choosing the least-obstructed side. */
export function journeyCompanionPosition(
  target: TourRect | null,
  viewport: { width: number; height: number },
  size: { width: number; height: number },
  avoid: TourRect | null = null,
) {
  const width = Math.min(size.width, viewport.width - 24),
    height = Math.min(size.height, viewport.height - 24),
    gap = 18;
  const clamp = (n: number, max: number) =>
    Math.max(12, Math.min(n, Math.max(12, max)));
  const t = target || {
    x: viewport.width / 2,
    y: viewport.height / 2,
    width: 0,
    height: 0,
  };
  const options = [
    { x: t.x + (t.width - width) / 2, y: t.y + t.height + gap },
    { x: t.x + (t.width - width) / 2, y: t.y - height - gap },
    { x: t.x + t.width + gap, y: t.y + (t.height - height) / 2 },
    { x: t.x - width - gap, y: t.y + (t.height - height) / 2 },
    ...(avoid
      ? [
          { x: avoid.x + avoid.width + gap, y: t.y + (t.height - height) / 2 },
          { x: avoid.x - width - gap, y: t.y + (t.height - height) / 2 },
          { x: t.x + (t.width - width) / 2, y: avoid.y + avoid.height + gap },
          { x: t.x + (t.width - width) / 2, y: avoid.y - height - gap },
        ]
      : []),
  ].map((p) => ({
    x: clamp(p.x, viewport.width - width - 12),
    y: clamp(p.y, viewport.height - height - 12),
  }));
  const overlap = (p: { x: number; y: number }) =>
    Math.max(0, Math.min(p.x + width, t.x + t.width) - Math.max(p.x, t.x)) *
    Math.max(0, Math.min(p.y + height, t.y + t.height) - Math.max(p.y, t.y));
  const cardOverlap = (p: { x: number; y: number }) =>
    avoid
      ? Math.max(
          0,
          Math.min(p.x + width, avoid.x + avoid.width) - Math.max(p.x, avoid.x),
        ) *
        Math.max(
          0,
          Math.min(p.y + height, avoid.y + avoid.height) -
            Math.max(p.y, avoid.y),
        )
      : 0;
  const best = options.sort(
    (a, b) =>
      overlap(a) * 1000 + cardOverlap(a) - overlap(b) * 1000 - cardOverlap(b),
  )[0];
  return { ...best, width, height };
}

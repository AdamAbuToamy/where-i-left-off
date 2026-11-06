export type TourRect = { x: number; y: number; width: number; height: number };
export function tourGeometry(
  target: TourRect | null,
  viewport: { width: number; height: number },
  card: { width: number; height: number },
) {
  const margin = 16,
    gap = 20,
    w = viewport.width,
    h = viewport.height,
    cw = Math.min(card.width, w - 24),
    ch = Math.min(card.height, h - 24);
  const clamp = (n: number, min: number, max: number) =>
    Math.max(min, Math.min(n, Math.max(min, max)));
  const focus = target
    ? {
        x: clamp(target.x - 7, margin, w - margin - 1),
        y: clamp(target.y - 7, margin, h - margin - 1),
        width: 0,
        height: 0,
      }
    : null;
  if (focus && target) {
    focus.width = Math.max(
      1,
      clamp(target.x + target.width + 7, margin, w - margin) - focus.x,
    );
    focus.height = Math.max(
      1,
      clamp(target.y + target.height + 7, margin, h - margin) - focus.y,
    );
  }
  let x = (w - cw) / 2,
    y = (h - ch) / 2;
  if (focus) {
    x = clamp(focus.x + (focus.width - cw) / 2, 12, w - cw - 12);
    if (h - (focus.y + focus.height) > ch + gap)
      y = focus.y + focus.height + gap;
    else if (focus.y > ch + gap) y = focus.y - ch - gap;
    else if (w > 800 && w - (focus.x + focus.width) > cw + gap) {
      x = focus.x + focus.width + gap;
      y = focus.y + (focus.height - ch) / 2;
    } else if (w > 800 && focus.x > cw + gap) {
      x = focus.x - cw - gap;
      y = focus.y + (focus.height - ch) / 2;
    } else y = h - ch - 16;
  }
  return {
    focus,
    card: {
      x: clamp(x, 12, w - cw - 12),
      y: clamp(y, 12, h - ch - 12),
      width: cw,
      height: ch,
    },
  };
}

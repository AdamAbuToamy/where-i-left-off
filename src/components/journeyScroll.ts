/** Browser boundary: reveal a new guide target in its nested scroll surfaces before measuring it. */
export function revealJourneyTarget(
  node: HTMLElement,
  viewport: { top: number; left: number; width: number; height: number },
) {
  const rect = node.getBoundingClientRect();
  if (!rect.width || !rect.height) return false;
  let top = viewport.top + 16,
    bottom = viewport.top + viewport.height - 16,
    left = viewport.left + 12,
    right = viewport.left + viewport.width - 12;
  for (
    let parent = node.parentElement;
    parent && parent !== document.body;
    parent = parent.parentElement
  ) {
    const style = getComputedStyle(parent);
    if (/auto|scroll|hidden|clip/.test(style.overflowY + style.overflowX)) {
      const bounds = parent.getBoundingClientRect();
      if (parent.clientHeight > 0) {
        top = Math.max(top, bounds.top + 12);
        bottom = Math.min(bottom, bounds.bottom - 12);
      }
      if (parent.clientWidth > 0) {
        left = Math.max(left, bounds.left + 8);
        right = Math.min(right, bounds.right - 8);
      }
    }
  }
  const oversized = rect.height > bottom - top;
  const visible = oversized
    ? rect.top >= top && rect.top <= top + 64
    : rect.top >= top && rect.bottom <= bottom;
  if (visible && rect.left >= left && rect.right <= right) return false;
  node.scrollIntoView({
    block: oversized ? "start" : "center",
    inline: "nearest",
    behavior: "instant",
  });
  return true;
}

import { useEffect, useRef } from "react";
import { useReducedMotion } from "motion/react";
import { annotate } from "rough-notation";
/** Dedicated wrapper contains Rough Notation's SVG; no application DOM is replaced. */
export default function RoughMark({
  children,
  active,
  type = "underline",
  color = "var(--site-primary)",
  rtl = false,
}: {
  children: string;
  active: boolean;
  type?: "underline" | "circle";
  color?: string;
  rtl?: boolean;
}) {
  const target = useRef<HTMLSpanElement>(null),
    reduced = useReducedMotion();
  useEffect(() => {
    const element = target.current;
    if (!active || !element) return;
    const mark = annotate(element, {
      type,
      color,
      animate: !reduced,
      animationDuration: 420,
      strokeWidth: 1.6,
      padding: type === "circle" ? 5 : 2,
      iterations: 2,
      multiline: true,
      rtl,
    });
    mark.show();
    for (const svg of element.parentElement?.querySelectorAll(
      "svg.rough-annotation",
    ) || []) {
      svg.setAttribute("aria-hidden", "true");
      svg.setAttribute("focusable", "false");
    }
    const resize = () => {
      mark.hide();
      mark.show();
    };
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      mark.remove();
    };
  }, [active, type, color, children, rtl, reduced]);
  return (
    <span className="board-mark">
      <span ref={target}>{children}</span>
    </span>
  );
}

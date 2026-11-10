import { useEffect, useId, useRef } from "react";
import type { CurriculumCourse } from "./curriculum";
/** Layout-only adapter: domain relationships remain validated by curriculum.ts. */
export default function CurriculumConnections({
  courses,
}: {
  courses: CurriculumCourse[];
}) {
  const ref = useRef<SVGSVGElement>(null),
    marker = useId().replace(/:/g, "");
  useEffect(() => {
    const svg = ref.current,
      board = svg?.parentElement;
    if (!svg || !board) return;
    let frame = 0;
    const draw = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const box = board.getBoundingClientRect();
        const nodes = new Map(
          Array.from(
            board.querySelectorAll<HTMLElement>("[data-curriculum-code]"),
            (el) => [el.dataset.curriculumCode, el],
          ),
        );
        const paths = svg.querySelector("g")!;
        paths.replaceChildren();
        svg.setAttribute("viewBox", `0 0 ${box.width} ${box.height}`);
        for (const course of courses) {
          const to = nodes.get(course.code)?.getBoundingClientRect();
          if (!to) continue;
          for (const code of course.requires) {
            const from = nodes.get(code)?.getBoundingClientRect();
            if (!from) continue;
            const path = document.createElementNS(
              "http://www.w3.org/2000/svg",
              "path",
            );
            const x1 = from.left + from.width / 2 - box.left,
              y1 = from.bottom - box.top,
              x2 = to.left + to.width / 2 - box.left,
              y2 = to.top - box.top;
            path.setAttribute(
              "d",
              `M${x1},${y1} C${x1},${y1 + 30} ${x2},${y2 - 30} ${x2},${y2}`,
            );
            path.setAttribute("marker-end", `url(#${marker})`);
            paths.append(path);
          }
        }
      });
    };
    const observer = new ResizeObserver(draw);
    observer.observe(board);
    for (const el of board.querySelectorAll("article")) observer.observe(el);
    draw();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [courses, marker]);
  return (
    <svg ref={ref} className="curriculum-connections" aria-hidden="true">
      <defs>
        <marker
          id={marker}
          markerWidth="7"
          markerHeight="7"
          refX="6"
          refY="3"
          orient="auto"
        >
          <path d="M0 0L0 6L6 3z" fill="#7c8f82" />
        </marker>
      </defs>
      <g fill="none" stroke="#7c8f82" strokeWidth="1.5" />
    </svg>
  );
}

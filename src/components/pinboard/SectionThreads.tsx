import { useEffect, useState } from "react";
import type { RefObject } from "react";
type Thread = { id: string; section: string; path: string };
/** These strings visualize shared section membership, never task dependencies. */
export default function SectionThreads({
  root,
  revision,
}: {
  root: RefObject<HTMLDivElement | null>;
  revision: string;
}) {
  const [threads, setThreads] = useState<Thread[]>([]);
  useEffect(() => {
    const board = root.current;
    if (!board) return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const origin = board.getBoundingClientRect(),
          groups = new Map<string, { id: string; x: number; y: number }[]>();
        for (const card of board.querySelectorAll<HTMLElement>(
          "[data-board-section]",
        )) {
          const section = card.dataset.boardSection,
            pin = card.querySelector(".board-pin");
          if (!section || !pin) continue;
          const point = pin.getBoundingClientRect();
          const entries = groups.get(section) || [];
          entries.push({
            id: card.dataset.boardId || "",
            x: point.left + point.width / 2 - origin.left,
            y: point.top + point.height / 2 - origin.top,
          });
          groups.set(section, entries);
        }
        const paths: Thread[] = [];
        for (const [section, points] of groups) {
          const first = points[0];
          for (const point of points.slice(1)) {
            const arc = Math.max(38, Math.abs(point.x - first.x) * 0.12);
            paths.push({
              id: section + ":" + point.id,
              section,
              path: `M ${first.x} ${first.y} C ${first.x} ${first.y - arc}, ${point.x} ${point.y - arc}, ${point.x} ${point.y}`,
            });
          }
        }
        setThreads(paths);
      });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(board);
    for (const card of board.querySelectorAll("[data-board-section]"))
      observer.observe(card);
    window.addEventListener("resize", measure);
    board.addEventListener("transitionend", measure);
    const settled = setTimeout(measure, 300);
    measure();
    return () => {
      clearTimeout(settled);
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", measure);
      board.removeEventListener("transitionend", measure);
    };
  }, [root, revision]);
  return (
    <svg className="pinboard-threads" aria-hidden="true">
      {threads.map((thread) => (
        <path
          key={thread.id}
          d={thread.path}
          data-thread-section={thread.section}
          pathLength={1}
        />
      ))}
    </svg>
  );
}

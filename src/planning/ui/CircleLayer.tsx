import { useMemo, useRef, useState } from "react";
import { useReactFlow, useViewport } from "@xyflow/react";
import rough from "roughjs";
import type { BoardCircle, Point } from "../domain";
const generator = rough.generator();
export default function CircleLayer({
  circles,
  drawing,
  onDraw,
  selected,
  onSelect,
}: {
  circles: BoardCircle[];
  drawing: boolean;
  onDraw: (points: Point[]) => void;
  selected: string;
  onSelect: (id: string) => void;
}) {
  const { x, y, zoom } = useViewport(),
    flow = useReactFlow(),
    points = useRef<Point[]>([]),
    [trail, setTrail] = useState<Point[]>([]);
  const marks = useMemo(
    () =>
      circles.map((circle) => {
        const seed =
          Array.from(circle.id).reduce(
            (sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0,
            1,
          ) || 1;
        const shape = generator.ellipse(
          circle.x + circle.width / 2,
          circle.y + circle.height / 2,
          circle.width,
          circle.height,
          {
            seed,
            stroke: "#ab433d",
            strokeWidth: 2,
            roughness: 0.65,
            bowing: 0.5,
          },
        );
        return { circle, paths: generator.toPaths(shape) };
      }),
    [circles],
  );
  const point = (event: React.PointerEvent<SVGSVGElement>) =>
    flow.screenToFlowPosition({ x: event.clientX, y: event.clientY });
  return (
    <svg
      className={`plan-circle-layer ${drawing ? "is-drawing" : ""}`}
      onPointerDown={(event) => {
        if (!drawing || event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        points.current = [point(event)];
        setTrail(points.current);
      }}
      onPointerMove={(event) => {
        if (
          !drawing ||
          !event.currentTarget.hasPointerCapture(event.pointerId) ||
          points.current.length >= 3000
        )
          return;
        points.current = [...points.current, point(event)];
        setTrail(points.current);
      }}
      onPointerUp={(event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
        event.currentTarget.releasePointerCapture(event.pointerId);
        const final = points.current;
        points.current = [];
        setTrail([]);
        if (drawing) onDraw(final);
      }}
      onPointerCancel={() => {
        points.current = [];
        setTrail([]);
      }}
    >
      <g transform={`translate(${x} ${y}) scale(${zoom})`}>
        {marks.map(({ circle, paths }) => (
          <g
            key={circle.id}
            data-planning-circle={circle.id}
            className={selected === circle.id ? "is-selected" : ""}
          >
            {paths.map((path, index) => (
              <path
                key={index}
                d={path.d}
                stroke={path.stroke}
                strokeWidth={path.strokeWidth}
                fill={path.fill || "none"}
                pointerEvents="none"
                aria-hidden="true"
              />
            ))}
            {!drawing && (
              <ellipse
                cx={circle.x + circle.width / 2}
                cy={circle.y + circle.height / 2}
                rx={circle.width / 2}
                ry={circle.height / 2}
                fill="none"
                stroke="transparent"
                strokeWidth={18}
                style={{ pointerEvents: "stroke", cursor: "pointer" }}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelect(circle.id);
                }}
              />
            )}
          </g>
        ))}
        {trail.length > 1 && (
          <path
            d={trail
              .map((p, index) => `${index ? "L" : "M"} ${p.x} ${p.y}`)
              .join(" ")}
            fill="none"
            stroke="#ab433d"
            strokeWidth={2}
          />
        )}
      </g>
    </svg>
  );
}

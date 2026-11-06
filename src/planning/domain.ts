export type Point = { x: number; y: number };
export type BoardItem = Point &
  (
    | { id: string; kind: "card"; projectId: string }
    | { id: string; kind: "note"; text: string }
    | { id: string; kind: "zone"; title: string; width: number; height: number }
  );
export type ThreadKind = "related" | "part" | "depends";
export type BoardThread = {
  id: string;
  source: string;
  target: string;
  kind?: ThreadKind;
  label?: string;
};
export type BoardCircle = Point & { id: string; width: number; height: number };
export type PlanningState = {
  version: 1;
  items: BoardItem[];
  threads: BoardThread[];
  circles: BoardCircle[];
};
export const emptyPlanningState = (): PlanningState => ({
  version: 1,
  items: [],
  threads: [],
  circles: [],
});
type PlanningErrorCode =
  | "planning-cycle"
  | "planning-invalid"
  | "planning-full"
  | "planning-circle"
  | "planning-conflict"
  | "planning-account"
  | "planning-local";
export class PlanningError extends Error {
  readonly code: PlanningErrorCode;
  constructor(code: PlanningErrorCode) {
    super(code);
    this.code = code;
  }
}
const fail = (): never => {
  throw new PlanningError("planning-invalid");
};
const object = (value: unknown): Record<string, unknown> =>
  !value || typeof value !== "object" || Array.isArray(value)
    ? fail()
    : (value as Record<string, unknown>);
const keys = (value: Record<string, unknown>, expected: string[]) => {
  if (
    Object.keys(value).length !== expected.length ||
    Object.keys(value).some((key) => !expected.includes(key))
  )
    fail();
};
const id = (value: unknown): string =>
  typeof value === "string" && /^[-\w]{1,100}$/.test(value) ? value : fail();
const coordinate = (value: unknown): number =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  Math.abs(value) <= 20000
    ? value
    : fail();
const list = (value: unknown, max: number): unknown[] =>
  Array.isArray(value) && value.length <= max ? value : fail();
const unique = (values: string[]) => {
  if (new Set(values).size !== values.length) fail();
};

/** Canvas data is independent of project content, ranks, and execution commands. */
export function parsePlanningState(value: unknown): PlanningState {
  const data = object(value);
  keys(data, ["version", "items", "threads", "circles"]);
  if (data.version !== 1) fail();
  const items: BoardItem[] = list(data.items, 200).map((raw) => {
    const item = object(raw),
      point = { id: id(item.id), x: coordinate(item.x), y: coordinate(item.y) };
    if (item.kind === "card") {
      keys(item, ["id", "kind", "projectId", "x", "y"]);
      return { ...point, kind: "card", projectId: id(item.projectId) };
    }
    if (item.kind === "zone") {
      keys(item, ["id", "kind", "title", "width", "height", "x", "y"]);
      if (
        typeof item.title !== "string" ||
        item.title.length > 100 ||
        typeof item.width !== "number" ||
        item.width < 240 ||
        item.width > 4000 ||
        typeof item.height !== "number" ||
        item.height < 180 ||
        item.height > 4000 ||
        !Number.isFinite(item.width) ||
        !Number.isFinite(item.height)
      )
        return fail();
      return {
        ...point,
        kind: "zone",
        title: item.title,
        width: item.width,
        height: item.height,
      };
    }
    if (
      item.kind !== "note" ||
      typeof item.text !== "string" ||
      item.text.length > 2000
    )
      return fail();
    keys(item, ["id", "kind", "text", "x", "y"]);
    return { ...point, kind: "note", text: item.text };
  });
  unique(items.map((item) => item.id));
  unique(
    items.filter((item) => item.kind === "card").map((item) => item.projectId),
  );
  const itemIds = new Set(
    items.filter((item) => item.kind !== "zone").map((item) => item.id),
  );
  const threads = list(data.threads, 400).map((raw) => {
    const edge = object(raw);
    keys(edge, [
      "id",
      "source",
      "target",
      ...("kind" in edge ? ["kind"] : []),
      ...("label" in edge ? ["label"] : []),
    ]);
    if (
      edge.kind !== undefined &&
      !["related", "part", "depends"].includes(String(edge.kind))
    )
      return fail();
    if (
      edge.label !== undefined &&
      (typeof edge.label !== "string" || edge.label.length > 240)
    )
      return fail();
    const result = {
      id: id(edge.id),
      source: id(edge.source),
      target: id(edge.target),
      ...(edge.kind !== undefined ? { kind: edge.kind as ThreadKind } : {}),
      ...(edge.label !== undefined ? { label: edge.label as string } : {}),
    };
    if (
      result.source === result.target ||
      !itemIds.has(result.source) ||
      !itemIds.has(result.target)
    )
      fail();
    return result;
  });
  const dependencies = new Map<string, string[]>();
  for (const edge of threads)
    if (edge.kind === "depends")
      dependencies.set(edge.source, [
        ...(dependencies.get(edge.source) || []),
        edge.target,
      ]);
  const visiting = new Set<string>(),
    visited = new Set<string>();
  const visit = (node: string) => {
    if (visiting.has(node)) throw new PlanningError("planning-cycle");
    if (visited.has(node)) return;
    visiting.add(node);
    for (const next of dependencies.get(node) || []) visit(next);
    visiting.delete(node);
    visited.add(node);
  };
  for (const node of dependencies.keys()) visit(node);
  unique(threads.map((edge) => edge.id));
  unique(threads.map((edge) => [edge.source, edge.target].sort().join("/")));
  const circles = list(data.circles, 120).map((raw) => {
    const circle = object(raw);
    keys(circle, ["id", "x", "y", "width", "height"]);
    const width = coordinate(circle.width),
      height = coordinate(circle.height);
    if (width < 20 || height < 20 || width > 4000 || height > 4000) fail();
    return {
      id: id(circle.id),
      x: coordinate(circle.x),
      y: coordinate(circle.y),
      width,
      height,
    };
  });
  unique(circles.map((circle) => circle.id));
  const state: PlanningState = { version: 1, items, threads, circles };
  if (JSON.stringify(state).length > 150000)
    throw new PlanningError("planning-full");
  return state;
}
export function addBoardCard(
  state: PlanningState,
  projectId: string,
  point: Point,
): PlanningState {
  if (
    state.items.some(
      (item) => item.kind === "card" && item.projectId === projectId,
    )
  )
    return state;
  return parsePlanningState({
    ...state,
    items: [
      ...state.items,
      { id: projectId, kind: "card", projectId, ...point },
    ],
  });
}
export function addBoardNote(
  state: PlanningState,
  noteId: string,
  point: Point,
): PlanningState {
  return parsePlanningState({
    ...state,
    items: [...state.items, { id: noteId, kind: "note", text: "", ...point }],
  });
}
export function moveBoardItem(
  state: PlanningState,
  itemId: string,
  point: Point,
): PlanningState {
  const moving = state.items.find((item) => item.id === itemId);
  const dx = point.x - (moving?.x || 0),
    dy = point.y - (moving?.y || 0);
  return parsePlanningState({
    ...state,
    items: state.items.map((item) => {
      if (item.id === itemId) return { ...item, ...point };
      if (
        moving?.kind === "zone" &&
        item.kind !== "zone" &&
        item.x >= moving.x &&
        item.x < moving.x + moving.width &&
        item.y >= moving.y &&
        item.y < moving.y + moving.height
      )
        return { ...item, x: item.x + dx, y: item.y + dy };
      return item;
    }),
  });
}
export function editBoardNote(
  state: PlanningState,
  itemId: string,
  text: string,
): PlanningState {
  return parsePlanningState({
    ...state,
    items: state.items.map((item) =>
      item.id === itemId && item.kind === "note" ? { ...item, text } : item,
    ),
  });
}
export function removeBoardItem(
  state: PlanningState,
  itemId: string,
): PlanningState {
  return parsePlanningState({
    ...state,
    items: state.items.filter((item) => item.id !== itemId),
    threads: state.threads.filter(
      (edge) => edge.source !== itemId && edge.target !== itemId,
    ),
  });
}
export function connectBoardItems(
  state: PlanningState,
  edgeId: string,
  source: string,
  target: string,
): PlanningState {
  if (
    state.threads.some(
      (edge) =>
        (edge.source === source && edge.target === target) ||
        (edge.source === target && edge.target === source),
    )
  )
    return state;
  return parsePlanningState({
    ...state,
    threads: [...state.threads, { id: edgeId, source, target }],
  });
}
export function removeBoardThread(
  state: PlanningState,
  edgeId: string,
): PlanningState {
  return {
    ...state,
    threads: state.threads.filter((edge) => edge.id !== edgeId),
  };
}
export function removeBoardCircle(
  state: PlanningState,
  circleId: string,
): PlanningState {
  return {
    ...state,
    circles: state.circles.filter((circle) => circle.id !== circleId),
  };
}
/** Recognize a closed circle/oval gesture, then replace jitter with a clean ellipse. */
export function recognizeCircle(
  points: readonly Point[],
  circleId: string,
): BoardCircle {
  if (
    points.length < 12 ||
    points.length > 3000 ||
    points.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))
  )
    throw new PlanningError("planning-circle");
  const xs = points.map((p) => p.x),
    ys = points.map((p) => p.y);
  const left = Math.min(...xs),
    top = Math.min(...ys),
    width = Math.max(...xs) - left,
    height = Math.max(...ys) - top;
  const center = { x: left + width / 2, y: top + height / 2 };
  if (
    width < 20 ||
    height < 20 ||
    width > 4000 ||
    height > 4000 ||
    Math.hypot(points[0].x - points.at(-1)!.x, points[0].y - points.at(-1)!.y) >
      Math.max(width, height) * 0.45
  )
    throw new PlanningError("planning-circle");
  const angles = new Set<number>();
  const error =
    points.reduce((sum, p) => {
      const x = (p.x - center.x) / (width / 2),
        y = (p.y - center.y) / (height / 2);
      angles.add(
        Math.floor(((Math.atan2(y, x) + Math.PI) / (2 * Math.PI)) * 12) % 12,
      );
      return sum + Math.abs(Math.hypot(x, y) - 1);
    }, 0) / points.length;
  if (angles.size < 9 || error > 0.32)
    throw new PlanningError("planning-circle");
  const circle = { id: circleId, x: left, y: top, width, height };
  parsePlanningState({ ...emptyPlanningState(), circles: [circle] });
  return circle;
}

/** Semantic edits share the board journal, including undo and revision checks. */
export function editBoardThread(
  state: PlanningState,
  edgeId: string,
  changes: { kind?: ThreadKind; label?: string; reverse?: boolean },
) {
  return parsePlanningState({
    ...state,
    threads: state.threads.map((edge) =>
      edge.id === edgeId
        ? {
            ...edge,
            ...(changes.kind !== undefined ? { kind: changes.kind } : {}),
            ...(changes.label !== undefined ? { label: changes.label } : {}),
            ...(changes.reverse
              ? { source: edge.target, target: edge.source }
              : {}),
          }
        : edge,
    ),
  });
}
export function addBoardZone(
  state: PlanningState,
  zoneId: string,
  point: Point,
  title: string,
) {
  return parsePlanningState({
    ...state,
    items: [
      ...state.items,
      { id: zoneId, kind: "zone", ...point, title, width: 620, height: 420 },
    ],
  });
}
export function editBoardZone(
  state: PlanningState,
  zoneId: string,
  changes: {
    title?: string;
    width?: number;
    height?: number;
    x?: number;
    y?: number;
  },
) {
  return parsePlanningState({
    ...state,
    items: state.items.map((item) =>
      item.id === zoneId && item.kind === "zone"
        ? { ...item, ...changes }
        : item,
    ),
  });
}
export function convertBoardNote(
  state: PlanningState,
  noteId: string,
  projectId: string,
) {
  const note = state.items.find((item) => item.id === noteId);
  if (note?.kind !== "note") throw new PlanningError("planning-invalid");
  return parsePlanningState({
    ...state,
    items: state.items.map((item) =>
      item.id === noteId
        ? { id: noteId, kind: "card", projectId, x: item.x, y: item.y }
        : item,
    ),
  });
}
/** Outgoing depends means source waits for target. Missing records never count as completed. */
export function boardBlockers(
  state: PlanningState,
  itemId: string,
  status: ReadonlyMap<string, string>,
) {
  const source = state.items.find((item) => item.id === itemId);
  if (source?.kind === "card" && status.get(source.projectId) === "done")
    return [];
  return state.threads
    .filter((edge) => edge.source === itemId && edge.kind === "depends")
    .flatMap((edge) => {
      const item = state.items.find((item) => item.id === edge.target);
      return item?.kind === "card" && status.get(item.projectId) !== "done"
        ? [item]
        : [];
    });
}
export function boardNeighborhood(state: PlanningState, itemId: string) {
  return new Set([
    itemId,
    ...state.threads.flatMap((edge) =>
      edge.source === itemId
        ? [edge.target]
        : edge.target === itemId
          ? [edge.source]
          : [],
    ),
  ]);
}

export function boardBounds(
  state: PlanningState,
  sizes: ReadonlyMap<string, { width: number; height: number }> = new Map(),
) {
  const rectangles = [
    ...state.items.map((item) => ({
      ...item,
      width:
        item.kind === "zone" ? item.width : sizes.get(item.id)?.width || 260,
      height:
        item.kind === "zone" ? item.height : sizes.get(item.id)?.height || 220,
    })),
    ...state.circles,
  ];
  if (!rectangles.length) return null;
  const x = Math.min(...rectangles.map((r) => r.x)),
    y = Math.min(...rectangles.map((r) => r.y));
  return {
    x,
    y,
    width: Math.max(...rectangles.map((r) => r.x + r.width)) - x,
    height: Math.max(...rectangles.map((r) => r.y + r.height)) - y,
  };
}

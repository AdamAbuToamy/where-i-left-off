import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type {
  CSSProperties,
  KeyboardEvent,
  MouseEvent,
  PointerEvent,
  RefObject,
} from "react";
import {
  clampLauncher,
  dockAtEdge,
  positionForDock,
  snapLauncher,
  validDock,
} from "./mobileLauncherGeometry";
import type {
  Dock,
  LauncherBounds,
  Point,
  SafeArea,
} from "./mobileLauncherGeometry";
const PHONE_QUERY =
  "(pointer: coarse) and (max-width: 767px), (pointer: coarse) and (max-height: 500px)";
function subscribe(changed: () => void) {
  const media = window.matchMedia?.(PHONE_QUERY);
  media?.addEventListener("change", changed);
  return () => media?.removeEventListener("change", changed);
}
function phoneSnapshot() {
  return window.matchMedia?.(PHONE_QUERY).matches ?? false;
}
function viewport() {
  const view = window.visualViewport;
  return {
    width: view?.width || innerWidth,
    height: view?.height || innerHeight,
    left: view?.offsetLeft || 0,
    top: view?.offsetTop || 0,
  };
}
function readSafeArea(): SafeArea {
  const probe = document.createElement("div");
  probe.style.cssText =
    "position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)";
  document.body.append(probe);
  const style = getComputedStyle(probe),
    area = {
      top: parseFloat(style.paddingTop) || 0,
      right: parseFloat(style.paddingRight) || 0,
      bottom: parseFloat(style.paddingBottom) || 0,
      left: parseFloat(style.paddingLeft) || 0,
    };
  probe.remove();
  return area;
}
/** Device-only launcher placement. No account content or server writes. */
export function useMobileLauncher(
  uid: string,
  button: RefObject<HTMLButtonElement | null>,
  open: boolean,
) {
  const mobile = useSyncExternalStore(subscribe, phoneSnapshot, () => false);
  const [view, setView] = useState(viewport),
    [point, setPoint] = useState<Point | null>(null),
    [dragging, setDragging] = useState(false);
  const dock = useRef<Dock>({ edge: "left", ratio: 1 }),
    last = useRef<Point>({ x: 12, y: 12 }),
    ignoreClick = useRef(false);
  const gesture = useRef<{
    id: number;
    x: number;
    y: number;
    origin: Point;
    moved: boolean;
  } | null>(null);
  const key = "wilo-assistant-position:" + uid;
  const safeArea = useRef<SafeArea>({ top: 0, right: 0, bottom: 0, left: 0 });
  function bounds(): LauncherBounds {
    const rect = button.current?.getBoundingClientRect(),
      v = viewport();
    return {
      width: v.width,
      height: v.height,
      buttonWidth: rect?.width || 170,
      buttonHeight: rect?.height || 52,
      safeArea: safeArea.current,
    };
  }
  function place(next: Point) {
    last.current = next;
    setPoint(next);
  }
  function persist(next: Dock) {
    dock.current = next;
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      /* Placement still works for this session. */
    }
    place(positionForDock(next, bounds()));
  }
  useLayoutEffect(() => {
    if (!mobile) return;
    try {
      const value: unknown = JSON.parse(localStorage.getItem(key) || "null");
      dock.current = validDock(value) ? value : { edge: "left", ratio: 1 };
    } catch {
      dock.current = { edge: "left", ratio: 1 };
    }
    const update = () => {
      safeArea.current = readSafeArea();
      const v = viewport();
      setView((previous) =>
        Object.keys(v).every(
          (name) =>
            v[name as keyof typeof v] === previous[name as keyof typeof v],
        )
          ? previous
          : v,
      );
      if (!gesture.current) {
        const rect = button.current?.getBoundingClientRect();
        const next = positionForDock(dock.current, {
          width: v.width,
          height: v.height,
          buttonWidth: rect?.width || 170,
          buttonHeight: rect?.height || 52,
          safeArea: safeArea.current,
        });
        last.current = next;
        setPoint(next);
      }
    };
    update();
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    if (button.current) observer?.observe(button.current);
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    return () => {
      observer?.disconnect();
      gesture.current = null;
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
    };
  }, [mobile, key, button]);
  useEffect(
    () => () => {
      gesture.current = null;
    },
    [],
  );
  function onPointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (!mobile || open || !event.isPrimary || event.button !== 0) return;
    ignoreClick.current = false;
    const rect = event.currentTarget.getBoundingClientRect(),
      v = viewport();
    gesture.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      origin: { x: rect.left - v.left, y: rect.top - v.top },
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function onPointerMove(event: PointerEvent<HTMLButtonElement>) {
    const current = gesture.current;
    if (!current || event.pointerId !== current.id) return;
    const dx = event.clientX - current.x,
      dy = event.clientY - current.y;
    if (!current.moved && Math.hypot(dx, dy) < 6) return;
    current.moved = true;
    ignoreClick.current = true;
    setDragging(true);
    event.preventDefault();
    place(
      clampLauncher(
        { x: current.origin.x + dx, y: current.origin.y + dy },
        bounds(),
      ),
    );
  }
  function finish(event: PointerEvent<HTMLButtonElement>, cancelled = false) {
    const current = gesture.current;
    if (!current || current.id !== event.pointerId) return;
    gesture.current = null;
    setDragging(false);
    if (current.moved) persist(snapLauncher(last.current, bounds()));
    if (cancelled) ignoreClick.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  }
  function consumeClick(event: MouseEvent<HTMLButtonElement>) {
    if (mobile && ignoreClick.current && event.detail !== 0) {
      ignoreClick.current = false;
      event.preventDefault();
      event.stopPropagation();
      return true;
    }
    return false;
  }
  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (!mobile || open || event.altKey || event.ctrlKey || event.metaKey)
      return;
    const edge = (
      {
        ArrowLeft: "left",
        ArrowRight: "right",
        ArrowUp: "top",
        ArrowDown: "bottom",
      } as const
    )[event.key as "ArrowLeft"];
    if (!edge) return;
    event.preventDefault();
    persist(dockAtEdge(edge, last.current, bounds()));
  }
  const launcherStyle: CSSProperties | undefined =
    mobile && point
      ? {
          position: "fixed",
          left: point.x + view.left,
          top: point.y + view.top,
          right: "auto",
          bottom: "auto",
          transition: dragging
            ? "none"
            : "left 240ms cubic-bezier(.2,.8,.2,1), top 240ms cubic-bezier(.2,.8,.2,1)",
        }
      : undefined;
  return {
    mobile,
    view,
    dragging,
    launcherStyle,
    onPointerDown,
    onPointerMove,
    onPointerUp: (event: PointerEvent<HTMLButtonElement>) => finish(event),
    onPointerCancel: (event: PointerEvent<HTMLButtonElement>) =>
      finish(event, true),
    onLostPointerCapture: (event: PointerEvent<HTMLButtonElement>) =>
      finish(event, true),
    onKeyDown,
    consumeClick,
  };
}

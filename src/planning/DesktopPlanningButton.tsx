import {
  lazy,
  Suspense,
  useState,
  useSyncExternalStore,
  useEffect,
} from "react";
import { Network } from "lucide-react";
import type { Project, Section } from "../types";
import type { Language } from "../translations";
const BoardDialog = lazy(() => import("./ui/PlanningBoardDialog"));
const query = "(min-width: 1024px) and (pointer: fine)";
const subscribe = (changed: () => void) => {
  const media = matchMedia(query);
  media.addEventListener("change", changed);
  return () => media.removeEventListener("change", changed);
};
const snapshot = () => matchMedia(query).matches;
export default function DesktopPlanningButton(props: {
  uid: string;
  scope: string;
  projects: Project[];
  sections: Section[];
  language: Language;
  onOpenCard: (id: string) => void;
}) {
  const desktop = useSyncExternalStore(subscribe, snapshot, () => false),
    [open, setOpen] = useState(() => {
      const value = new URLSearchParams(location.hash.split("?")[1]).get(
        "board",
      );
      return value === "default" || (!!value && /^[-\w]{1,80}$/.test(value));
    }),
    [boardId, setBoardId] = useState(() => {
      const value =
        new URLSearchParams(location.hash.split("?")[1]).get("board") || "";
      return value === "default"
        ? ""
        : /^[-\w]{1,80}$/.test(value)
          ? value
          : "";
    });
  useEffect(() => {
    let active = true;
    const read = () => {
      const raw = new URLSearchParams(location.hash.split("?")[1]).get("board");
      if (raw === "default" || (raw && /^[-\w]{1,80}$/.test(raw)))
        queueMicrotask(() => {
          if (active) {
            setBoardId(raw === "default" ? "" : raw!);
            setOpen(true);
          }
        });
    };
    window.addEventListener("hashchange", read);
    return () => {
      active = false;
      window.removeEventListener("hashchange", read);
    };
  }, []);
  function selectBoard(id: string) {
    setBoardId(id);
    const params = new URLSearchParams(location.hash.split("?")[1]);
    params.set("board", id || "default");
    history.replaceState(
      history.state,
      "",
      location.pathname +
        location.search +
        location.hash.split("?")[0] +
        "?" +
        params.toString(),
    );
  }
  const label = { ar: "لوح الخطة", en: "Planning board", he: "לוח תכנון" }[
    props.language
  ];
  if (!desktop) return null;
  return (
    <>
      <button
        type="button"
        className="planning-launch"
        onClick={() => setOpen(true)}
        onMouseEnter={() => {
          void import("./ui/PlanningBoardDialog");
        }}
      >
        <Network size={17} aria-hidden="true" />
        {label}
      </button>
      {open && (
        <Suspense fallback={<span role="status">…</span>}>
          <BoardDialog
            key={props.scope + "/" + boardId}
            {...props}
            boardId={boardId}
            onSelectBoard={selectBoard}
            onClose={() => {
              setOpen(false);
              const params = new URLSearchParams(location.hash.split("?")[1]);
              if (params.has("board")) {
                params.delete("board");
                history.replaceState(
                  history.state,
                  "",
                  location.pathname +
                    location.search +
                    "#" +
                    location.hash.split("?")[0].replace(/^#/, "") +
                    (params.size ? "?" + params.toString() : ""),
                );
              }
            }}
          />
        </Suspense>
      )}
    </>
  );
}

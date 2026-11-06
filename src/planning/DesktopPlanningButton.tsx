import { lazy, Suspense, useState, useSyncExternalStore } from "react";
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
  onConvertNote?: (noteId: string, text: string) => Promise<string | null>;
}) {
  const desktop = useSyncExternalStore(subscribe, snapshot, () => false),
    [open, setOpen] = useState(false);
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
          <BoardDialog {...props} onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </>
  );
}

import { auth } from "../lib/firebase";
import { useEffect, useRef, useState } from "react";
import { currentCard } from "../lib/workflow";
import { localDateKey } from "../lib/projects";
import { useExperience } from "./context";
import { cardKey } from "./state";
import { latestDue, occurrence, advanceRepeat } from "./templates";
export default function RecurringProcessor() {
  const { uid, view, workspace, cards, change } = useExperience()!,
    busy = useRef(false),
    handled = useRef(new Set<string>()),
    [error, setError] = useState(false),
    [retry, setRetry] = useState(0),
    rules = view.state.repeat;
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (
      busy.current ||
      !view.ready ||
      view.conflict ||
      view.error ||
      !workspace ||
      !cards ||
      cards.queued ||
      cards.cached ||
      cards.error
    )
      return;
    const today = localDateKey(),
      due = rules.filter(
        (r) =>
          r.enabled &&
          r.automatic &&
          r.next <= today &&
          !handled.current.has(r.id + ":" + today),
      );
    if (!due.length) return;
    busy.current = true;
    void (async () => {
      for (const rule of due) {
        if (!alive.current || auth?.currentUser?.uid !== uid) break;
        handled.current.add(rule.id + ":" + today);
        const project = cards!.projects.find(
          (p) => cardKey(p.id) === rule.card && currentCard(p),
        );
        if (!project) continue;
        const date = latestDue(rule, today);
        if (!date) continue;
        const card = occurrence(rule, project, date);
        await workspace!.addOnce(
          card.id,
          card.name,
          card.nextStep,
          (cards!.projects[0]?.rank || 1024) - 1024,
          card.details,
        );
        change((state) => advanceRepeat(state, rule, date));
      }
    })()
      .catch(() => {
        if (alive.current) setError(true);
      })
      .finally(() => {
        busy.current = false;
        if (alive.current) setRetry((n) => n + 1);
      });
  }, [
    view.ready,
    view.conflict,
    view.error,
    workspace,
    cards,
    rules,
    retry,
    change,
    uid,
  ]);
  if (!error) return null;
  return (
    <p className="pilot-error" role="alert">
      {document.documentElement.lang === "ar"
        ? "تعذّر إنشاء تكرار تلقائي. راجع القاعدة وحالة المزامنة."
        : "A recurring card could not be created. Check the rule and sync status."}
      <button
        onClick={() => {
          handled.current.clear();
          setError(false);
          setRetry((n) => n + 1);
        }}
      >
        {document.documentElement.lang === "ar" ? "إعادة المحاولة" : "Retry"}
      </button>
    </p>
  );
}

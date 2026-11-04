import { useEffect, useState, useCallback } from "react";
import type { ReactNode } from "react";
import { createExperienceRepository } from "./browserRepository";
import { RelationshipContext } from "./context";
import type { ExperienceState } from "./state";
/** Board-scoped only. The legacy codec retains saved data without running retired features. */
export default function BoardRelationshipsProvider({
  uid,
  children,
}: {
  uid: string;
  children: ReactNode;
}) {
  const [repository] = useState(() => createExperienceRepository(uid)),
    [view, setView] = useState(() => repository.view);
  useEffect(() => {
    const stop = repository.start(setView),
      online = () => repository.retry();
    window.addEventListener("online", online);
    return () => {
      window.removeEventListener("online", online);
      stop();
    };
  }, [repository]);
  const change = useCallback(
    (update: (state: ExperienceState) => ExperienceState) => {
      if (repository.view.conflict || repository.view.error)
        throw new Error("relationship-conflict");
      repository.apply(update(repository.state));
    },
    [repository],
  );
  return (
    <RelationshipContext value={{ uid, repository, view, change }}>
      {children}
    </RelationshipContext>
  );
}

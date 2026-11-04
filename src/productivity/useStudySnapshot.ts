import { useState } from "react";
import { UniversityStore } from "../university/store";
import { emptyUniversity } from "../university/state";
import { useStudySync } from "../university/useStudySync";
import { db } from "../lib/firebase";
export function useStudySnapshot(uid: string) {
  const [store] = useState(
      () => new UniversityStore(uid, db!.app.options.projectId || "local"),
    ),
    [initial] = useState(() => {
      try {
        return { state: store.load(), error: "" };
      } catch {
        return { state: emptyUniversity(), error: "study-cache-invalid" };
      }
    }),
    [state, setState] = useState(initial.state),
    cloud = useStudySync(store, uid, setState);
  return {
    state,
    status: cloud.status,
    error: initial.error,
    commit: cloud.commit,
  };
}

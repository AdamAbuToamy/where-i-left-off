import { useEffect } from "react";
import { auth, db } from "../lib/firebase";
import { BrowserSessionStore } from "./browserStore";
import { activeSessionWorkspaces, createSessionWorkspace } from "./composition";
import type { SessionRepository } from "./repository";
/** Flush accepted session edits even after the dialog has closed. */
export default function SessionOutboxSync({ uid }: { uid: string }) {
  useEffect(() => {
    let stopped = false,
      busy = false;
    const repositories = new Set<SessionRepository>();
    const flush = async () => {
      if (
        stopped ||
        busy ||
        !navigator.onLine ||
        !db ||
        auth?.currentUser?.uid !== uid
      )
        return;
      busy = true;
      try {
        const pending = await BrowserSessionStore.pending(
          db.app.options.projectId || "unconfigured",
          uid,
        );
        for (const journal of pending) {
          if (stopped || auth?.currentUser?.uid !== uid) break;
          if (
            activeSessionWorkspaces.has(uid + "/" + journal.state.id) ||
            journal.hasConflict
          )
            continue;
          const repository = createSessionWorkspace(uid, journal.state);
          repositories.add(repository);
          try {
            await repository.start(() => {});
            await repository.flush();
          } finally {
            repository.stop();
            repositories.delete(repository);
          }
        }
      } catch {
        /* Local outboxes stay intact for the next reconnect or explicit retry. */
      } finally {
        busy = false;
      }
    };
    const run = () => void flush(),
      timer = window.setInterval(run, 30000);
    window.addEventListener("online", run);
    window.addEventListener("wilo-session-local", run);
    run();
    return () => {
      stopped = true;
      clearInterval(timer);
      window.removeEventListener("online", run);
      window.removeEventListener("wilo-session-local", run);
      for (const repository of repositories) repository.stop();
    };
  }, [uid]);
  return null;
}

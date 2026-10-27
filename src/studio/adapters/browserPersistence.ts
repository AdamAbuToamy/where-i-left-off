import { isAdmin } from "../../lib/admin";
import { StudioError } from "../core/model";
import { validateStudioJournal } from "../core/validation";
import type { StudioJournal, StudioPersistence } from "../core/model";

export class BrowserStudioPersistence implements StudioPersistence {
  private listeners = new Set<() => void>();
  private readonly key: string;
  private readonly identity: () => {
    uid: string;
    email: string | null;
    emailVerified: boolean;
  } | null;
  private readonly uid: string;
  constructor(
    key: string,
    identity: () => {
      uid: string;
      email: string | null;
      emailVerified: boolean;
    } | null,
    uid: string,
  ) {
    this.key = key;
    this.identity = identity;
    this.uid = uid;
  }
  private check() {
    const user = this.identity();
    if (
      !user ||
      user.uid !== this.uid ||
      !isAdmin(user.email, user.emailVerified)
    )
      throw new StudioError("permission");
  }
  read(): StudioJournal | null {
    this.check();
    const raw = localStorage.getItem(this.key);
    return raw ? validateStudioJournal(JSON.parse(raw)) : null;
  }
  async transact(
    update: (current: StudioJournal | null) => StudioJournal,
  ): Promise<StudioJournal> {
    this.check();
    // Without a cross-tab lock we refuse writes rather than race two local journals.
    if (!navigator.locks) throw new Error("studio-lock-unavailable");
    return navigator.locks.request(this.key, () => {
      this.check();
      const next = validateStudioJournal(update(this.read()));
      const value = JSON.stringify(next);
      if (new TextEncoder().encode(value).length > 4500000)
        throw new Error("studio-storage-full");
      localStorage.setItem(this.key, value);
      for (const changed of this.listeners) changed();
      return next;
    });
  }
  subscribe(changed: () => void) {
    this.listeners.add(changed);
    const storage = (event: StorageEvent) => {
      if (event.key === this.key || event.key === null) changed();
    };
    window.addEventListener("storage", storage);
    return () => {
      this.listeners.delete(changed);
      window.removeEventListener("storage", storage);
    };
  }
}

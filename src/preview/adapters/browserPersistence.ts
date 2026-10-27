import { isAdmin } from "../../lib/admin";
import { PreviewError } from "../core/model";
import { validatePreviewJournal } from "../core/validation";
import type { PreviewJournal, PreviewPersistence } from "../core/model";

export class BrowserPreviewPersistence implements PreviewPersistence {
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
      throw new PreviewError("permission");
  }
  read(): PreviewJournal | null {
    this.check();
    const raw = localStorage.getItem(this.key);
    return raw ? validatePreviewJournal(JSON.parse(raw)) : null;
  }
  async transact(
    update: (current: PreviewJournal | null) => PreviewJournal,
  ): Promise<PreviewJournal> {
    this.check();
    // Without a cross-tab lock we refuse writes rather than race two local journals.
    if (!navigator.locks) throw new Error("preview-lock-unavailable");
    return navigator.locks.request(this.key, () => {
      this.check();
      const next = validatePreviewJournal(update(this.read()));
      const value = JSON.stringify(next);
      if (new TextEncoder().encode(value).length > 4500000)
        throw new Error("preview-storage-full");
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

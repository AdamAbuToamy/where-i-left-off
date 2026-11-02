import { validExtensionId } from "./extensionInstall";
import type { ExtensionConfig } from "./extensionInstall";

let pending: Promise<ExtensionConfig | null> | undefined;
/** Share only concurrent public configuration reads. No account data or persistent cache. */
export function loadExtensionConfig(): Promise<ExtensionConfig | null> {
  if (pending) return pending;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  pending = (async () => {
    try {
      const response = await fetch("/extension-config.json", {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) return null;
      const value: unknown = await response.json();
      if (
        !value ||
        typeof value !== "object" ||
        !("extensionId" in value) ||
        !validExtensionId(value.extensionId)
      )
        return null;
      return {
        extensionId: value.extensionId,
        published: "published" in value && value.published === true,
      };
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  })().finally(() => {
    pending = undefined;
  });
  return pending;
}

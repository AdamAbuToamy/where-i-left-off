import type { Plugin } from "vite";
import { cleanStaleAuthorizationUrl } from "../src/lib/cleanStaleAuthorizationUrl.ts";

/** Runs before application modules/diagnostics; never persists or logs callback values. */
export function bootstrapCallback(): Plugin {
  return {
    name: "wilo-clean-obsolete-auth-callback",
    transformIndexHtml() {
      return [
        {
          tag: "script",
          injectTo: "head-prepend" as const,
          children: `try { const clean = (${cleanStaleAuthorizationUrl.toString()})(location.href); if (clean !== null) history.replaceState(history.state, "", clean); } catch { /* URL cleanup must not block sign-in. */ }`,
        },
      ];
    },
  };
}

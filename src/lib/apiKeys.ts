import { getToken } from "firebase/app-check";
import type { User } from "firebase/auth";
import { auth, appCheck, emulatorMode } from "./firebase";
import { notificationEndpoint } from "./pushNotifications";
export type ApiKeyMetadata = {
  id: string;
  name: string;
  scopes: string[];
  createdAt: number;
  expiresAt: number | null;
  lastUsedAt: number | null;
  status: "active" | "expired" | "revoked";
};
export type ApiKeyResult = {
  keys?: ApiKeyMetadata[];
  availableScopes?: string[];
  key?: string;
  metadata?: ApiKeyMetadata;
};
/** Deliberately outside tracing, caches, persistence and analytics. */
export async function accountApiKeys(
  user: User,
  data: Record<string, unknown>,
): Promise<ApiKeyResult> {
  if (auth?.currentUser?.uid !== user.uid) throw Error("account-changed");
  const [endpoint, token, check] = await Promise.all([
    notificationEndpoint(),
    user.getIdToken(),
    emulatorMode
      ? Promise.resolve({ token: "local-browser-test-only" })
      : appCheck
        ? getToken(appCheck, false)
        : Promise.reject(Error("app-check-required")),
  ]);
  if (auth?.currentUser?.uid !== user.uid) throw Error("account-changed");
  const response = await fetch(new URL("/account-api-keys", endpoint), {
    method: "POST",
    cache: "no-store",
    credentials: "omit",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer " + token,
      "x-firebase-appcheck": check.token,
    },
    body: JSON.stringify(data),
    signal: AbortSignal.timeout(20000),
  });
  if (auth?.currentUser?.uid !== user.uid) throw Error("account-changed");
  const value = await response.json();
  if (!response.ok) throw Error("api-key-request-failed");
  return value.result;
}

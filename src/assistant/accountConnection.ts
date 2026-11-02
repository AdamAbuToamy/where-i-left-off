import { getToken } from "firebase/app-check";
import { auth, appCheck, emulatorMode } from "../lib/firebase";
import { notificationEndpoint } from "../lib/pushNotifications";
/** Uses fresh account/App Check tokens; provider credentials never come back from the server. */
export async function accountConnection(
  uid: string,
  data: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<Response> {
  const user = auth?.currentUser;
  if (!user || user.uid !== uid) throw new Error("account-changed");
  const [endpoint, identity, check] = await Promise.all([
    notificationEndpoint(),
    user.getIdToken(),
    emulatorMode
      ? Promise.resolve({ token: "local-browser-test-only" })
      : appCheck
        ? getToken(appCheck, false)
        : Promise.reject(new Error("app-check-required")),
  ]);
  if (auth?.currentUser?.uid !== uid) throw new Error("account-changed");
  const response = await fetch(new URL("/assistant-account", endpoint), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${identity}`,
      "X-Firebase-AppCheck": check.token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
    signal: signal ?? AbortSignal.timeout(20000),
  });
  if (auth?.currentUser?.uid !== uid) {
    await response.body?.cancel();
    throw new Error("account-changed");
  }
  return response;
}
export async function connectionCommand(
  uid: string,
  action: string,
  key?: string,
): Promise<boolean> {
  const response = await accountConnection(uid, {
    action,
    ...(key ? { key } : {}),
  });
  if (!response.ok) throw new Error("assistant-connection-unavailable");
  const body: unknown = await response.json();
  if (!body || typeof body !== "object" || !("result" in body))
    throw new Error("assistant-connection-unavailable");
  const result = body.result;
  if (
    !result ||
    typeof result !== "object" ||
    !("connected" in result) ||
    typeof result.connected !== "boolean"
  )
    throw new Error("assistant-connection-unavailable");
  return result.connected;
}

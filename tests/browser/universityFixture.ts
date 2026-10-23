import type { APIRequestContext } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { ADMIN_EMAIL } from "../../src/lib/admin";
/** All account operations target the local Firebase emulator, using disposable runtime credentials. */
export async function prepareUniversityPilot(request: APIRequestContext) {
  const base =
      "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:",
    password = randomUUID();
  const lookup = await request.post(base + "lookup?key=demo-key", {
    headers: { Authorization: "Bearer owner" },
    data: { email: [ADMIN_EMAIL] },
  });
  const existing = (await lookup.json()).users?.[0];
  let uid = existing?.localId;
  if (!uid) {
    const signup = await request.post(base + "signUp?key=demo-key", {
      data: { email: ADMIN_EMAIL, password, returnSecureToken: true },
    });
    if (!signup.ok()) throw new Error("Could not prepare emulator pilot");
    uid = (await signup.json()).localId;
  }
  const updated = await request.post(base + "update?key=demo-key", {
    headers: { Authorization: "Bearer owner" },
    data: {
      localId: uid,
      emailVerified: true,
      password,
      displayName: "University pilot",
    },
  });
  if (!updated.ok()) throw new Error("Could not verify emulator pilot");
  return { email: ADMIN_EMAIL, password, uid };
}

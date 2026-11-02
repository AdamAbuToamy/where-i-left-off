# Account-bound assistant connection — 2026-11-02

## Problem and decision
Pollinations authorization was retained in sessionStorage only. Closing a tab could lose the link; another phone/browser had no access to it. A new browser may not recover an already-lost key: one final consent is required in that case.

The server now retains an account-owned encrypted credential, never a plaintext Firestore document or browser localStorage key. AES-256-GCM uses a random96-bit nonce and UID as authenticated additional data. The encryption key is a dedicated Worker secret. Preserve it during redeployments; rotating it requires a versioned re-encryption migration. The local recovery copy is under ignored `.wrangler`, mode0600, not committed.

The HTTP root validates allowed origin, Firebase JWT, App Check, verified identity and active account. Only that verified UID addresses the D1 row; a client-supplied UID cannot choose another account. A foreign-key cascade removes the credential with the existing account-erasure path. The additive schema is in `push-worker/connection-schema.sql` and is included in new database setup.

Clients receive connection status only. Inference is proxied to a fixed Pollinations endpoint/model with bounded size/tokens, cancellation, a60-second budget and a per-user concurrency lease. The proxy performs no site writes and does not change model proposal validation, revisions or atomic application. No key, prompt or account content is added to logs. Pollinations can still expire or revoke its authorization; account persistence cannot bypass that provider decision. Its documented default is7days and it issues no refresh token. [Official account-linking documentation](https://github.com/pollinations/pollinations/blob/main/BRING_YOUR_OWN_POLLEN.md).

An existing account binding is authoritative over a stale device key. Existing session credentials migrate automatically after a confirmed server save, then are removed from sessionStorage. Isolated emulator journeys may still inject synthetic local provider keys; production never selects that adapter. A separate browser regression exercises the account proxy with no injected device key.

Network/quota failures retain the connection. Only explicit disconnect, account erasure or a provider401 revocation removes it. Disconnect is labeled as affecting all devices. Other open devices refresh status when focused/reopened, and a stale request receives connect-required instead of using another user's key.

## Verification
- Full application suite: **1245 passed /114 files** before the final3-test transport addition. Focused final provider/auth/transport run: **19 passed**; focused auth/transport/widget/provider run earlier: **47 passed**.
- Backend full suite: **878 passed** before adding2 more fault-path cases; final6 connection cases passed. Final full backend rerun: **880 passed**.
- Architecture:22 modules, zero violations.
- TypeScript passed; lint zero errors, one pre-existing requestGeneration cleanup warning.
- Browser emulator: **3 journeys passed**, including separate desktop/phone contexts plus reload on each with no browser provider key, phone drag/reveal and desktop dock regression.
- Earlier review security run:680 Firestore-emulator checks passed. No rules change in this feature; no new claim of live destructive security testing.
- Browser provider is injected, not live Pollinations. Physical installed-app lifecycle and a real approved key across the user's actual devices still require user verification.

## Rollout / rollback
Additive table and dedicated secret first, Worker second, Hosting last. Existing clients continue their previous direct path until updated. Rollback can restore the prior Hosting and Worker versions without deleting the encrypted table or secret. Do not drop either to roll back: this would discard connections. No Firebase Auth domain, rules, account credentials or project data changes are required.

## Live status
Publication and production fingerprints are recorded in `2026-11-02-account-connection-production.json` after completion. Do not infer live-provider success from emulator tests.

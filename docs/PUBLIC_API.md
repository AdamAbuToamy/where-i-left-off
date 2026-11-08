# Wilo Public API v1

Status (2026-11-08): deployed to the existing Worker and Hosting. Website200, API401 for missing/invalid keys, protected key-management rejection and published contract verified. Signed-in key issuance and authenticated account data access are not yet verified in production; no user key was available for this session.

Published contract: https://where-i-left-off.web.app/openapi-public-api.json (byte-identical to the source contract at deployment).

Wilo exposes its own personal account capabilities. It has no dependency on, or knowledge of, any consuming application. There is no background synchronization service.

## Create a key

In **Settings → API Keys**, enter a name, choose read/write scopes, optionally choose an expiration date, and select Create API Key. Save/copy the secret immediately. Closing the dialog, hiding the tab, leaving Settings or changing account destroys its display state. Only its SHA-256 digest is stored by Wilo; neither the user nor an administrator can retrieve the original value. A lost key must be replaced. Never put a key in client source code, a public repository, URL, log, or analytics event.

Keys can be revoked or replaced in Settings. Revocation deletes the credential record (including its hash and metadata); rotation deletes the old credential atomically. Only a credential-free audit event remains. Rotation preserves the active key’s scopes and expiry, creates a new secret and revokes the old credential in one D1 transaction. For an expired key, create a new key with a new expiry instead. Maximum 10 active keys per account; optional expiry up to 366 days. Only verified, available accounts can manage or use keys. The last 100 key metadata rows are shown. Revocation is checked on every request; no authentication cache is used. Requests already in flight can finish.

The key-management endpoint is intentionally unavailable to API keys: it requires the existing Wilo Firebase user token, Firebase App Check and allowed application Origin. Creating a key does not require any server credential from an end user.

## Authentication and use

Base URL after deployment: `https://wilo-free-push.adam2002hosny.workers.dev/api/v1`.

Use HTTPS and `Authorization: Bearer <your-key>`. Never send a key as a query parameter. Origin/CORS is not authentication. These endpoints are intended for trusted server/CLI/mobile clients; direct cross-origin web-page JavaScript is not enabled. Keep credentials on a trusted server when building a web client.

[OpenAPI 3.1 contract](openapi-public-api.json) contains the HTTP methods, request and response schemas, scopes and errors. Responses use `Cache-Control: no-store` and `Pragma: no-cache`.

Read and write scopes are independent. A write response contains an ID/revision/created flag, never existing private record contents. Reading data requires the corresponding read permission.

| Resources | Scope pair | Operations |
| --- | --- | --- |
| `/courses` | `courses:read`, `courses:write` | List, create, update course fields, prerequisites and study topics |
| `/tasks` | `tasks:read`, `tasks:write` | List/create/update assignments, exams and other university tasks |
| `/schedule` | `schedule:read`, `schedule:write` | List/create/update weekly classes |
| `/projects` | `projects:read`, `projects:write` | Personal cards: create/update content, status, links, sections, progress and archive/trash state |
| `/sections` | `sections:read`, `sections:write` | List/create/rename personal card sections |
| `/boards/personal` | `boards:read`, `boards:write` | Read/replace the personal planning board, notes, zones, threads and circles |
| `/reminders/{projectId}` | `reminders:read`, `reminders:write` | Read/change existing per-card reminder settings using Wilo's scheduler |

Collections support `GET ?limit=1..100&cursor=<last-id>`. Tasks/schedule also accept `courseId`. Collection create uses POST `{ "values": { ... } }`. Update uses PATCH `/{id}` with `{ "expectedRevision": 0, "values": { ... } }`. IDs and revisions come from read responses. No endpoint accepts an owner/account ID.

### Minimal example

Set `WILO_API_KEY` securely through your automation's secret manager. The examples deliberately do not contain a credential. Avoid shell tracing (`set -x`), verbose HTTP logs or recording Authorization headers. Do not paste a real key into shell command history.

```sh
WILO_API_BASE=https://wilo-free-push.adam2002hosny.workers.dev/api/v1
curl --silent --show-error "$WILO_API_BASE/courses" \
  -H "Authorization: Bearer $WILO_API_KEY"

curl --silent --show-error "$WILO_API_BASE/courses" \
  -H "Authorization: Bearer $WILO_API_KEY" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: example-course-create-0001' \
  --data '{"values":{"name":"Example course"}}'
```

The response is `{ "result": { "id": "...", "revision": 0, "created": true }, "requestId": "..." }`. Use its ID as `courseId`:

```json
{
  "values": {
    "courseId": "<returned-course-id>",
    "title": "Example assignment",
    "kind": "assignment",
    "due": "2026-12-01T12:00:00Z"
  }
}
```

POST this JSON to `/tasks` with a different Idempotency-Key. PATCH `/tasks/{id}` with `{"expectedRevision":0,"values":{"done":true}}` to complete an unlinked task.

## Safe retries, duplicates and conflicts

All resource writes except reminder settings require an `Idempotency-Key` of 16–128 characters. Retry the same method/path/body with the same key after a transport failure. Data and the receipt commit together in Firestore. Reusing the key with different content returns 409. Receipts are account-wide, so use distinct keys for separate operations and clients. TTL cleanup must retain them for at least 30 days; clients should not reuse old operation IDs.

Course creation matches normalized name plus URL. University tasks reuse the existing import duplicate predicate (course/title/kind/due) and existing stable source-link matching. A duplicate returns its existing ID without overwriting manual edits. Matching is not synchronization. Updates always require an exact revision; clients must reread and deliberately merge after 409. Conflicting or ambiguous writes never partially apply. Duplicate weekly classes are rejected by the existing planner.

Reminder PUT is an absolute settings replacement and is naturally idempotent: `{ "disabled":false, "weekly":false, "time":"09:00" }`. It uses the existing reminder store and scheduler, preserves unrelated settings and never enables global notification delivery, adds devices or sends an immediate notification. A concurrent explicit reminder edit follows existing last-writer-wins settings behavior. Global preferences must already allow delivery.

## Deliberately unavailable

- Account/security/admin operations, key management through bearer keys, billing/provider credentials, user lookup and arbitrary Firestore queries: would exceed personal automation permissions.
- Shared groups/boards, membership/invites/roles: need a separate group authorization contract and are not exposed through personal keys.
- Hard deletes and cascading course/section deletes: avoid accidental irreversible or cross-record data loss. Personal card trash/archive fields are supported instead.
- Editing the content of a university task linked to a reminder card, or editing that linked card through the generic write endpoint: returns `409 linked-reminder-use-ui`. The existing UI coordinates task/card/reminder state; this release does not bypass that workflow. Per-card reminder settings remain available through the reminder endpoint.
- Google login changes, push device subscription, global notification opt-in, model execution, file/media upload, and importing external-site data: not necessary for this API and have separate consent/permission requirements.

## Limits and errors

60 authenticated requests per account per minute across all keys; 30 key-management calls/minute; 10 active keys. Input limit30 KB (board requests200 KB, stored board payload150 KB). Each snapshot collection is capped at2000 documents and each upstream response at4 MiB: oversized accounts return413 instead of truncating data or weakening validation. Error bodies contain a stable `error` code and `requestId`, never a key, payload or upstream response. 401 = invalid key; 403 = missing scope/unavailable account; 409 = conflict; 422 = invalid domain data; 429 = rate limit; 503 = dependency/API unavailable. Retry-After is included for429/503. Reuse the original idempotency key after uncertain writes.

Audit records contain account ID, key ID, operation category, HTTP status and timestamp only; no content, prompts, query strings, raw URLs, headers or credential values. Audit acceptance is required before writes. Failed final diagnostics can produce503 after a successful commit; idempotent retry recovers the saved result. Audit rows expire after30 days through the existing cron. Account deletion cascades through D1 key/audit rows. Firestore API receipts remain owner-private under unchanged rules and follow the existing account deletion process.

## Internal deployment (operator only; approval required)

1. Run the verification commands below. Do not test against real account data.
2. Apply additive `push-worker/api-schema.sql` to the existing D1 database. Do not replace existing schema or preferences.
3. Configure a keyless internal data-writer service account in the current Firebase project. Grant a custom Firestore role with `datastore.databases.get` and `datastore.entities.get/list/create/update` only; no delete, Auth-admin, IAM-admin or key-creation permission. Grant the existing protected reader signer a custom role containing only `iam.serviceAccounts.getAccessToken`, on this writer service account resource only. Enable IAM Service Account Credentials API if needed. Never create/download another private key.
4. Configure Worker `API_WRITER_SERVICE_ACCOUNT` (service-account email, not a secret), `PUBLIC_API_ENABLED=true`. Existing `FIREBASE_READER` remains server-protected. The Worker obtains short-lived600-second writer tokens internally. End users and API clients never receive them. Existing Google Login/App Check remain unchanged.
5. Deploy Worker with remote provider/model/secrets/bindings preserved (`--keep-vars` where appropriate), then Hosting. Perform only read-only production smoke checks unless separately authorized to write synthetic data.
6. Rollback: set `PUBLIC_API_ENABLED=false` (immediately disables issuance/use), restore previous Hosting/Worker versions if necessary. Keep additive tables and data; do not drop credentials or modify existing records. Previously issued keys stay revoked/active as recorded if re-enabled.

This is internal Wilo platform setup performed by its operator, never a per-user or API-client task. No additional service/hosting/dependency is introduced. IAM permissions cannot be restricted to individual Firestore users, so the backend's account/allowlist checks are mandatory. See [Google's short-lived impersonation model](https://docs.cloud.google.com/iam/docs/service-account-impersonation) and [D1 transaction rollback behavior](https://developers.cloudflare.com/d1/observability/find-expensive-queries/).

## Synthetic verification

```sh
npm run check:api:domain
npm run test:api
npm run test:api:emulator
npm test
npm run test:rules
npm run test:auth:recovery
node --test push-worker/*.test.mjs
npm run check:architecture
npm run lint
npx tsc -b
VITE_USE_EMULATORS=false npm run build
node scripts/check-git-secrets.mjs
```

Use Node24 and Java21 for Firestore/Auth emulators. API tests generate ephemeral synthetic keys in memory and do not print/store them. `api-runtime.test.mjs` uses actual workerd/D1 with an injected synthetic repository and blocked outbound network; `apiFirestore.emulator.mjs` uses actual local Firestore REST transactions; neither is a live-provider or production/IAM validation. Domain runtime is generated from existing TypeScript by `scripts/generate-api-domain.mjs`; CI rejects a stale artifact instead of maintaining a second domain implementation.

## Assignment reminder linking — v1.1

`POST /tasks/{id}/reminder` requires `courses:read`, `tasks:read`, `tasks:write`, `reminders:read`, `reminders:write`. Send JSON `{"expectedRevision":0}` with a unique Idempotency-Key; replace0 with the task revision from a recent read. The server derives the account from the key, validates the task/course/card ownership, and uses the same native university card fields and reminder scheduler as the UI. Consumers cannot choose an arbitrary card or account and never receive Firebase credentials.

Read `GET /tasks/{id}/reminder` with `tasks:read` and `reminders:read`. Check both `status` and `scheduled`: a200 is not a promise of notification delivery. `scheduled:true` requires read-back of the linked native card, actual D1 settings, account preferences, scope registration and an existing device. `disabled`, `awaiting-device`, `outside-window`, `manual-recurring`, `incomplete` and `unlinked` are explicit non-scheduled states; `verified` describes state read-back only. Existing recurring/manual settings are preserved without rewriting them. User opt-in/device setup stays in Wilo.

A new link requires an unfinished future-due task and existing enabled due notifications. The account timezone, lead minutes and quiet period are used; no external/default timezone or new schedule is created. Existing/manual links are returned without changing card names, dates or reminder settings. Generic content edits to linked tasks/cards remain restricted to the coordinated UI workflow.

Repeated calls, including different operation IDs for the same task, reuse its single link. Firestore atomically commits task/card/receipt/recovery intent. A staged card is paused until D1 configuration succeeds. D1 settings use insert-if-absent; replay never overwrites a manual edit. The existing Worker cron drains bounded recovery hints and wakes its existing reminder scope. No second scheduler/service or broadened IAM role is introduced.200 with `scheduled:true` is verified configuration, not evidence a push was delivered.202 means incomplete recovery, never success: poll GET and retry the same POST/body/idempotency key if needed.409 manual/pref/revision conflicts require review, not blind overwrites.

Internal rollout: apply additive `push-worker/reminder-link-schema.sql` to existing D1 before deploying the Worker. It contains CREATE TABLE/INDEX IF NOT EXISTS only. The table is a cross-store recovery hint, not a parallel reminder database; delivery remains in existing cards/scopes/events/queues. Rollback must preserve pending intents and paused cards; disable PUBLIC_API_ENABLED if needed while assessing recovery, never delete pending user data. No additional IAM permission is required.


## Universal card reminders (v1.3)

These operations use the existing Wilo Push queue, subscriptions and minute scheduler. No browser needs to remain open. Configure account notification preferences from Settings → Notifications on desktop or mobile; Push enrollment remains per device. An enrolled phone receives account reminders configured from desktop. Do not assume provider acceptance proves arrival on a device.

| Operation | Scopes | Purpose |
|---|---|---|
| `GET /reminders/{projectId}` | `reminders:read` | Read settings, `settingsVersion`, computed `scheduledAt`, quiet-adjusted `effectiveAt`, and actual scheduling/dispatch state. |
| `PUT /reminders/{projectId}` | `reminders:write` | Set or reschedule an owned personal card reminder. |
| `DELETE /reminders/{projectId}` | `reminders:write` | Disable/cancel its reminder; retain its configuration for review. |
| `POST /tasks/{id}/reminder` | `courses:read tasks:read tasks:write reminders:read reminders:write` | Link an owned university task to a native reminder card; use returned projectId for subsequent editing. |
| `GET /tasks/{id}/reminder` | `tasks:read reminders:read` | Verify the link and actual scheduling state. |
| `POST /tasks/{id}/notification` | `courses:read tasks:read reminders:write` | Request one immediate notification from trusted assignment data. |
| `GET /tasks/{id}/notification` | `tasks:read reminders:read` | Inspect immediate dispatch state. |
| `POST /projects/{id}/notification` | `projects:read reminders:write` | Request one immediate notification for an owned personal card. |
| `GET /projects/{id}/notification` | `projects:read reminders:read` | Inspect immediate card dispatch state. |

Confirm scopes in the downloadable OpenAPI contract. API keys cannot access group resources or another account's subscriptions. The UI preserves existing access to assigned group cards.

### Exact and relative schedules

Read the card reminder first. PUT includes its `expectedSettingsVersion` and a stable `Idempotency-Key` (16–128 ASCII identifier characters). Example body (replace the version and use a future date):

```json
{"expectedSettingsVersion":"REPLACE_WITH_SETTINGS_VERSION","disabled":false,"schedule":{"mode":"absolute","scheduledAt":"2027-11-15T09:00:00+02:00","timeZone":"Asia/Jerusalem"}}
```

Works for eligible personal cards with no due date, including completed non-archived cards. A relative schedule needs a due date:

```json
{"expectedSettingsVersion":"REPLACE_WITH_SETTINGS_VERSION","disabled":false,"schedule":{"mode":"relative","amount":3,"unit":"days","localTime":"09:00","timeZone":"Asia/Jerusalem"}}
```

For November 18 due dates, this means November 15 at 09:00 in Jerusalem. Minutes/hours subtract an exact duration from the due instant; days/weeks subtract calendar days and use localTime. `dueTime` optionally specifies the local deadline clock (otherwise the existing card/default clock is frozen). Timezones are IANA names. Nonexistent DST times are rejected. Ambiguous relative local times require `disambiguation: "earlier"` or `"later"`; absolute requests select an instant with their explicit UTC offset. Offset/zone mismatches are rejected. Past new schedules are rejected. Due-date edits recompute relative schedules; absolute reminders remain fixed.

DELETE sends `If-Match: SETTINGS_VERSION` and a stable `Idempotency-Key`, without a request body. `schedule:null` in PUT deliberately returns to automatic defaults. Legacy disabled/weekly/time updates remain supported and do not erase explicit settings when omitted.

On 409 reread current settings and review changes rather than overwriting manual edits. Replaying an accepted key returns current state without restoring an old schedule over subsequent manual changes. A different payload with the same key conflicts. Linking a task reuses the native card/outbox; after a timeout, retry the same request and read its status instead of creating another reminder card.

### Preference policy and delivery state

Account-wide enabled/disabled, card inclusion/disabled flags and quiet hours remain authoritative. Explicit schedules take precedence over automatic due/stale timing and suppress duplicate default reminders for the same card; changing defaults does not rewrite them. Quiet hours defer delivery to their end in the **account** timezone, even when the explicit schedule uses another zone. `scheduledAt` is intended time; `effectiveAt` previews quiet deferral. Native weekly reminders retain their legacy behavior.

The cron runs once per minute; queue load and provider latency add delay. This is not exact-to-the-second delivery. Status distinguishes configured, pending, awaiting-device, scheduled, disabled, expired/invalid-schedule, push-queued, dispatching, provider-accepted, failed and unknown. `handsetDelivery: "not-confirmed"` is intentional: Wilo has no delivery receipt from the phone. Review counts per state; partial acceptance is not universal delivery. Expired subscriptions are removed only for their owner. Editing/cancelling/deleting cards invalidates queued stale events before sending.

### Immediate notification workflow

Create the assignment using the existing task API, then POST its notification route with `{"expectedRevision": CURRENT_REVISION}` and a stable Idempotency-Key. Wilo reads the title and course from owned data; clients cannot specify recipients, subscriptions or arbitrary text. One logical immediate event is allowed per resource, including retries with new keys. GET never sends. Next link the assignment using POST task reminder with a schedule, then GET reminder state to verify setup. Notifications require enabled account preferences and an enrolled device. Disabled preferences and quiet hours are respected.

202 means durable pending/queued/deferred work, not phone delivery. Read status after a timeout. Queue-acknowledgement loss is recovered by the existing cron. An uncertain provider send is recorded as unknown and is not blindly resent; at-most-once dispatch avoids duplicate handset alerts but cannot guarantee delivery after a provider/network ambiguity. Immediate jobs expire after 24 hours. Do not issue a new logical notification to compensate without checking current state.

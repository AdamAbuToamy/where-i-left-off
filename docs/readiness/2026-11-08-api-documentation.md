# Developer documentation readiness — 2026-11-08

## State

Deployed after explicit owner approval on 2026-11-08. No Commit or Push. Existing unrelated untracked reports/capture-import files preserved. API authentication, permissions, database schema and key lifecycle are unchanged.

## User experience

- Public route `/#/api-docs`, reachable from the API Keys heading in Settings only. It renders outside the account gate; visiting Account Settings still requires sign-in.
- Arabic and English documentation matching Wilo tokens/components, lazy-loaded without Swagger UI or any added dependency. Other language settings display English documentation with appropriate content direction/language metadata.
- Quick Start, authentication, course-to-assignment workflow, searchable operation reference, scope badges, required/optional fields and enums, parameters, response statuses,401/403/429 response-shape examples, idempotency/revision conflicts, pagination and key rotation/revocation guidance.
-19 method/path operations derive from the actual OpenAPI source. URL, methods, schemas, required fields, parameters and scope descriptions are read from the contract.57 request examples (cURL, Python requests, JavaScript fetch) plus3 full workflows. Copy buttons and the actual contract download use placeholders only. No key input, storage or executable API playground.
- No special User-Agent requirement exists in the Wilo contract/auth handler. Documentation does not claim the earlier403 was caused by that header, nor suggest bypasses. It distinguishes Wilo JSON error diagnostics from an HTML network-protection response.
- Download links to the same contract copied by the production build; the browser-test build now publishes that artifact too.

## Verification

- Published `https://where-i-left-off.web.app/openapi-public-api.json`: GET200, byte-identical to source. Final `node scripts/verify-api-doc-examples.mjs --published` passed. One intermediate network timeout was retried; no source drift was found.
- Synthetic-only executable verification:57 generated requests +3 workflows in cURL/Python/Node;9 error handling cases401/403/429.39 captured write bodies validated with JSON Schema2020-12 against the actual OpenAPI. No account API request was sent to production.
- `npm test`:1329 tests /136 files passed. Focused documentation/key settings tests:8 passed. Scope search, navigation focus, exact clipboard content, clipboard failure, public route, settings link, and generated request metadata covered.
- Browser journeys:3 passed on isolated preview5198, desktop1280 and phone390 including Arabic RTL. No browser login, real key, real data writes or Worker data request. Actual clipboard, navigation, search, expanded operation layout, anonymous contract download and byte comparison verified. Horizontal overflow after opening examples was found and corrected; regression asserted. Screenshots inspected.
- Quality: lint, TypeScript build, architecture checks, production build and credential/diff checks recorded at completion. Existing large-chunk Vite warning persists; no new library added.

## Limits

Not a live authenticated API test, production release, physical-device check or full signed-in browser regression. Backend/rules suites were not rerun because this feature changes no backend, auth or persistence policy. The published contract's existing descriptions remain unmodified, including its historical server deployment note; source/download/examples stay identical.

The executable example verifier uses existing local Python requests/jsonschema tools solely for tests, not runtime dependencies. Repeat with Node24: `node scripts/verify-api-doc-examples.mjs --published`. Standard browser journey: `TEST_PREVIEW_PORT=5198 node scripts/run-browser-tests.mjs tests/browser/apiDocumentation.spec.ts` with Java21. Public docs do not execute examples; consumers run them locally with their own credentials and permissions.

## Approved production release

- Hosting release marker: `wilo-api-docs-20261108`; public documentation URL: https://where-i-left-off.web.app/#/api-docs.
- Worker version: `86314467-748e-432e-86f2-fa9c10160062`. All19 remote bindings/variables matched their pre-deploy metadata fingerprint; existing provider/model/credentials and queues retained.
- Owner requested no retention of revoked credentials. Revocation now atomically audits and deletes the credential row; rotation atomically inserts the replacement and deletes the old row. Audit events contain no secret, digest, name or scopes. Existing revoked rows were removed through `api-purge-revoked.sql`; read-only aggregate verification returned revoked_remaining=0. Active/expired-but-unrevoked credentials were excluded by SQL predicate.
- Backend906 tests passed, including atomic deletion/rotation, audit-failure rollback, owner isolation and legacy purge preservation of active keys. Lint and production App Check-enabled build passed.
- Read-only live verification: index, contract, release marker and documentation JS/CSS (5 files) byte/hash-identical to the local release. Anonymous courses API still401/no-store. No real key issuance, account-data test writes or browser login.
- No source Commit/Push was performed. Deployment approval was used for Hosting/Worker and the specifically requested revoked-record cleanup only.

## Placement correction

Removed the global footer documentation link at the owner’s request. The API Keys settings link and public documentation route remain available. Hosting-only correction; backend unchanged.

API key creation options are now collapsed behind an Add API Key button, with explicit cancel, focus on the name field, and collapse/reset after successful issuance. Five key-settings tests plus synthetic desktop/mobile checks passed; production build and focused lint passed. Both placement corrections were deployed to Hosting; no backend change for this UI adjustment.

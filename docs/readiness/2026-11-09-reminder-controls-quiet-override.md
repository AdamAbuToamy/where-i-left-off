# Reminder UI, legacy write compatibility and per-key quiet override — 2026-11-09

Official workspace `/home/adam/projects/where-i-left-off`, main, baseline `14037b0fc3738db51ea834e4213b14c8ca8f0bbc`. Covers all three consecutive owner requests (permission error screenshots, missing full reminder UI including groups, and per-key quiet-hours override). No Personal Hub or Email Agent changes.

## Corrected behavior

The university still used its legacy create/update reminder button; now course task rows, dashboard rows and the task edit dialog expose Set reminder and open the existing universal editor. A new draft card stays disabled until the explicit save. No due date, disabled account preferences and different device/account zones do not prevent configuring an exact reminder. The account timezone controls the due-date projection. Existing explicit settings are not rewritten when task content changes.

API-written projects could persist their path `id` as a field forbidden by client Firestore rules. The server serializer now omits it; the university sync adapter strips it from a legacy card during a user-initiated revision-checked edit. Actual rules reproduce the rejection and allow the corrected write. No rules are weakened and no bulk production data repair is performed.

Non-manager members can now open the card reminder editor. Group membership and current resource access are rechecked server-side, including at scheduled delivery. Readable group cards may have a personal explicit reminder even when assigned to another member; its settings/devices belong only to the configuring UID. Automatic defaults remain restricted to the assigned member, avoiding unsolicited reminders to all members.

## Quiet policy

Owner-only authenticated/App Check key management adds quietHoursOverride (default false) on each key. Update works without reissuing a secret; rotation preserves policy; scopes and account preferences remain independent. External data API keys cannot update this setting. Notification POST adds bypassQuietHours (default false). True without permission returns 403 quiet-hours-override-forbidden. Usual scopes, ownership, account opt-out, card exclusion and device withdrawal still apply.

D1 records the requesting key and per-event policy. Expiry/revocation/permission withdrawal is rechecked before provider dispatch and restores quiet deferral. Regranting does not create another event. An authorized explicit request with a new Idempotency-Key promotes the same pending event, including after replacing its original key; same eventId and per-device claims remain. A changed payload under an old key conflicts. Processing events are not promoted mid-send; poll and retry the promotion when pending. Completed events never resend. Audit contains owner/key/operation/status only. Scheduled reminders never bypass quiet hours.

## Verified locally

- Application: 137 files, 1334 tests passed (`/tmp/wilo-followup-app-final.log`).
- Worker: 940 tests passed (`/tmp/wilo-followup-worker-final.log`). Focused tests cover default-off, per-key/user isolation, explicit request, normal scope enforcement, revocation/rotation, deferred promotion/replay, account/device withdrawal, synthetic Push encryption, group reminders and path-ID serialization. Additive migration preserves old records with override off.
- Firestore rules: 18 files, 693 tests passed (`/tmp/wilo-followup-rules-final.log`), including the reproduced legacy-card error and no-date draft setup under actual rules.
- Authentication recovery: 4 tests passed (`/tmp/wilo-followup-auth-final.log`).
- Browser: 7 focused journeys passed (`/tmp/wilo-followup-browser.log`): documentation, desktop/mobile card controls, university task save/configuration, and non-manager group member explicit reminders. Emulator accounts/real client rules, mocked notification HTTP. Screenshots `.wrangler/reminder-editor-{phone,desktop}.png`.
- OpenAPI 1.4: 26 routes/operations, 78 three-language request examples, 6 workflows and 9 error cases checked locally; 55 bodies include the declared override examples (`/tmp/wilo-followup-doc-examples.log`). No live data writes.
- Lint, TypeScript, architecture and credential pattern gates passed. Production build and deployment proof are recorded by the release operator separately; this local report alone is not evidence of phone delivery or real OAuth.

## Release boundaries

Apply guarded additive metadata migration before Worker rollout, preserve all bindings/variables, then publish matching production Hosting/OpenAPI. Use existing infrastructure and minute scheduler. Final runtime proof is `.wrangler/universal-reminders-production.json`, migration proof `.wrangler/quiet-override-migration-proof.json` (ignored operator artifacts). Production checks are public contract/asset hashes and unauthenticated denial, plus anonymous public UI availability. No real user's key, assignment, card, reminder or device is changed as a test. Physical phone delivery and an authenticated production override are not verified by emulator/provider tests.

The requested university knowledge file remains absent; project/domain validators and existing authorization are retained. Recovery patch/bundle is stored under `/home/adam/wilo-recovery/20261109-reminders-quiet-override`; old development recovery copy remains untouched.

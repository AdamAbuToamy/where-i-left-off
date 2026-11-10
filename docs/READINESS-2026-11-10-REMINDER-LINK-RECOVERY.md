# University reminder linkage recovery — 2026-11-10

## Verified cause and boundaries
An owner-scoped production investigation confirmed that affected assignment records, native linkage intents, backing cards and reminder schedules still existed. The backing cards were marked trashed before the assignment/card separation deployment. The reminder routes resolve owner-scoped storage directly; the personal-card projection filter is not used in that lookup. Attribution of the earlier trash action is not established by available evidence.

No private report, account identifiers, titles, device subscriptions or credentials are included here. Owner-specific snapshots and recovery evidence are held outside Git with restricted permissions.

## Compatible change
Public API 1.5.2 adds POST /tasks/{id}/reminder/repair. Preview is the default and returns current revisions without changing data. Actual restoration requires explicit restoreTrashed=true, dryRun=false, exact task/project revisions and the same five scopes as native reminder linking. Only a correctly typed, unique owned helper with a complete matching native intent may be restored. Missing/archived/shared/unproven records fail safely.

Only the helper trash flag/revision and operation receipt change; no reminder, assignment, settings, delivery claim or Push subscription is recreated. Existing native recovery hints and wake scheduling close partial-failure windows. Idempotent replay does not reapply restoration or undo a later deletion. Existing routes, global preferences and visual separation stay intact.

The actual OpenAPI and in-app reference document the distinction between tasks, internal helpers and independent reminders. Copyable examples prefer the contract's no-write preview.

## Verification
- Complete Worker suite: 978 passed, including recovery/ownership/scopes/idempotency/manual settings/partial wake failure and reminder reads while helpers are absent from the personal list.
- Complete application suite: 1369 passed. Additional API documentation focused suite: 5 passed after preview-example coverage.
- Complete Firestore security suite: 694 passed.
- Browser emulator journeys: 7 passed, covering desktop/mobile separation, assignment/group reminder UI, public documentation/copy/download/RTL.
- Architecture and generated-domain checks passed. Production build, lint and credential scan are final release gates.
- Synthetic test records only. No test Push sent.

## Production recovery procedure
Use the reviewed native recovery service with existing operator credentials, dry-run and revision guards against only the verified owner linkage. Preserve exact original reminder identities and schedules. Compare before/after Firestore and D1 snapshots, then reread the original collections and verify scheduler/account/device state. Do not manufacture new API keys, widen IAM, or access another project's secrets.

No dedicated Wilo API test credential was found in project configuration. Independent authenticated production HTTP happy-path verification is therefore NOT PERFORMED; owner-scoped native-service/production-storage verification is a different evidence category. Physical phone arrival for future reminders cannot be certified before delivery.

Private evidence/recovery directory: /home/adam/wilo-recovery/20261110-reminder-incident/ (not committed). No destructive migration, rules change, new scheduler or new service is required.

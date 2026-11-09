# Unified native reminder projection — 2026-11-09

## Cause and compatible correction

The v1.5 collection recognized schedule/remindAt/weekly/lead overrides but omitted old `time`-only/API-link settings. The planner/delivery fallback-suppression conditions also used a narrower, different classification. Separately, legacy history lookup depended on the candidate being currently dispatchable, hiding provider acceptance after account/category opt-out.

A shared pure classifier now distinguishes `account-default`, `legacy-explicit` and `independent`. Existing time, lead, weekly and API-intent configurations appear under stable id `legacy` beside independent records. UI, collection API, legacy card API and task-link status use the same native read model. Account fallback remains visible as `superseded` when independent records replace it; it is not advertised as an extra scheduled alert. Old records with no override/provenance remain account-default: the server does not invent historical intent.

No eager migration, destructive SQL, copying of schedules, new scheduler or API-key changes. No reads mutate card settings or create duplicate legacy records. Scheduled delivery retains existing event identity/device claims; a projection never becomes a second independent row. Non-recurring explicit legacy time/lead events freeze on first dispatch; existing modern fingerprints remain unchanged. Weekly recurrence and global stale behavior retain their existing path. Cancel legacy independently through the collection endpoint; card-wide DELETE remains backward-compatible. User edits rearm only the selected configuration; unchanged automatic retries do not clear cancellation. Native university time synchronization cannot reactivate cancelled reminders. The existing card-wide switch now accepts a validated partial update, preserving all individual schedules; ownership/type/version checks remain enforced.

The card list shows effectiveAt (after quiet hours) first and the original requested instant separately when different. Sent/provider-accepted history remains visible even if notifications are later disabled. Arrival on a physical handset is not inferred from provider acceptance.

## Evidence

-1344 application tests passed (140 files);4 new UI regressions cover mixed sources, adjusted time, independent legacy cancellation and editing actual old lead time.
-961 Worker tests passed;21 multiple-reminder integration tests cover legacy-only, independent-only, mixed, cancellation, sent history, quiet hours, event replay, due-date edits, scope/account isolation, native UI/API shared persisted records and mixed-response OpenAPI source/nullable-field compatibility. A full JSON Schema check also passed locally; permanent Worker tests keep their Node-only runtime.
-693 Firestore rules tests passed (rules unchanged).
-4 auth recovery emulator tests passed.
-7 desktop/mobile browser journeys passed for card/settings/university/group editors and public docs navigation/copy/download/RTL. Synthetic emulator records/intercepted HTTP, not production user tests.
-93 generated API request examples,6 workflows,9 error cases;67 request bodies validated against OpenAPI. OpenAPI now1.5.1, same31 operations; source/suppressed and cancelled/superseded states documented for legacy/task read models.
-TypeScript, architecture, lint, production build and credential-pattern scans are release gates in operator logs. Existing bundle size advisories remain.

## Rollout and limits

Deploy reviewed Worker and matching Hosting/OpenAPI; no database migration or IAM change. Preserve existing19 bindings and minute cron/queue. Safe anonymous production verification checks release/asset/contract identity, published schemas and invalid-key401 for existing/new methods. Production proof is retained at `.wrangler/unified-reminders-production.json` and recovery directory. Authenticated Assignment2/account inspection and phone arrival are NOT VERIFIED by read-only public checks. No real reminders are deleted or real cards used for test writes, and no unrequested Push is sent.

Recovery baseline bundle/source patch: `/home/adam/wilo-recovery/20261109-unified-reminders`. Keep native event/device ledgers and existing reminder rows; do not drop tables or restore user data blindly. Official workspace remains `/home/adam/projects/where-i-left-off`; recovery copy wilo-test untouched.

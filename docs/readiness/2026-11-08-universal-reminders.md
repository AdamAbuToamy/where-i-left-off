# Universal card reminders and immediate Push — 2026-11-08

Official workspace: `/home/adam/projects/where-i-left-off`, main; baseline `6388ae96b499cecbe544e3b2fa0e5665db590eac`. Existing recovery copy remains untouched. No Personal Hub/Email Agent changes.

## Architecture and preference policy

Reused existing account preferences, D1 cards, subscriptions, Worker minute cron, queue and Web Push sender. Shared pure schedule/update functions serve both authenticated UI and API adapters. Account preferences synchronize server-side; browser permission/Push enrollment remain local. Desktop settings do not subscribe the browser or require its permission. Explicit schedules override automatic due/stale timing, retain their own zone/clock and respect account enabled, card disabled and account quiet hours. Archived/trash are excluded. UI includes personal and assigned group cards; Public API remains personal owner-only. Resource types include project, book, course, video, series, film, shopping and idea; resume/waiting/deadline/list card kinds share the same editor. Explicit reminders also work for completed eligible cards.

Relative minutes/hours subtract a duration; days/weeks subtract calendar dates at a chosen local clock. Exact schedules work without due dates. IANA timezone and offset/calendar/past-time validation reject invalid/nonexistent local times; repeated times require explicit occurrence choice or an offset. Existing legacy weekly/default reminders retain behavior. Due-date edits recompute relative schedules. Native consumers recheck current card/settings before delivery; stale/cancelled events do not send.

Immediate task/project notifications use trusted owned data, stable logical resource events, durable D1 outbox recovery through existing cron and per-device claims. No arbitrary recipient/message fields. Provider acceptance is not device delivery. Unknown network/crash outcomes are not blindly resent. This trades possible missed delivery in uncertain failures for duplicate prevention, consistent with the existing at-most-once native pipeline. Immediate events expire after 24 hours. Minute cron/queues/provider latency prevent an exact-second SLA.

Advanced reminder PUT/DELETE require a version and stable operation key. Atomic CAS and receipts prevent concurrent cross-resource key reuse from changing two cards. Existing link outbox preserves manual settings across retries and partial failures. Legacy basic reminder writes remain compatible.

## Verified locally

- Application: 137 files, 1332 tests passed (`/tmp/wilo-universal-app-final.log`).
- Worker: 934 tests passed (`/tmp/wilo-universal-worker-final.log`). Includes ownership/scope/key revocation/rate-limit regressions, durable immediate queue recovery, duplicate prevention, synthetic real Web Push encryption/VAPID, universal native scheduled delivery, cancel/reschedule, quiet deferral, explicit non-task/no-date reminders, task absolute links and concurrent operation-key isolation.
- Firestore security: 17 files, 691 tests passed; Java 21 emulator (`/tmp/wilo-universal-rules-final.log`). Expected denied-write diagnostics are test evidence.
- Auth recovery: 4 tests passed (`/tmp/wilo-universal-auth-final.log`).
- Browser: 4 existing documentation/installed-phone preference journeys plus 2 new desktop/mobile universal-reminder journeys passed across focused runs. Synthetic Firebase accounts and mocked Push HTTP; not real OAuth or a physical phone. Screenshots under ignored `.wrangler/universal-reminders-{phone,desktop}.png`.
- OpenAPI 1.3: 26 operations, 78 generated three-language examples, 6 workflows, 9 error-handling cases; 51 JSON bodies checked against actual schemas on a local synthetic server (`/tmp/wilo-universal-doc-examples.log`).
- Architecture, lint, TypeScript and credential pattern checks passed; final production build is a separate release gate. Scanner is not a penetration test.

## Rollout and verification boundaries

Apply only additive `task-notification-schema.sql` and `reminder-state-schema.sql` to existing D1, then reviewed Worker, then matching Hosting/OpenAPI. No new cron/queue/service, Firebase rules/auth change, IAM broadening or destructive migration. Preserve remote Worker variables/bindings. Production build must run after browser fixtures and use existing public production Firebase/App Check config. Release manifest/asset hashes and Worker version/header establish deployed source; anonymous 401 proves authentication refusal, not authenticated API success.

Operator production proof is recorded separately in ignored `.wrangler/universal-reminders-production.json` after deployment; this local-readiness document alone does not assert a successful deployment. No real user data writes or unrequested Push smoke messages are authorized. Physical phone delivery and real Google OAuth remain unverified by these emulator/provider tests. Minimal owner test: on a subscribed phone, keep account notifications enabled; from desktop schedule one disposable owned card a few minutes ahead outside quiet hours, close the website, and check the phone. Provider-accepted still does not establish handset arrival without that observation.

`docs/knowledge/university/university_rules.md` was not present; no claim of reading it. Existing domain rules/validators, Firestore isolation and revision boundaries were retained. Existing broader browser suites with stale unrelated selectors were not declared passed.

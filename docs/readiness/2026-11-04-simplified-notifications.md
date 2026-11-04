# Simplified WILO and administrator notification bell — 2026-11-04

## Scope
Remove the ten-addition Work hub preview, retain meaningful relationships inside the existing desktop planning board, add an administrator-only notification bell, and reduce rendering/background work. Ordinary users keep their existing navigation. Main cards, login, existing university pages, assistant, sessions, weekly calendar, push consent and account data remain supported.

The removed features are their recent preview additions, not original University/Assistant pages. Inbox interception, new Today replacement, time planning, review hub, course-planning extras, preview assistant controls, history UI/new history recording, templates/recurrence processor, named boards and board exports no longer mount or run. Existing real cards/tasks created during testing and saved metadata are not destructively deleted. The old metadata codec remains only to preserve saved relationships and archived data during revisioned writes; its repository mounts when the board opens. Previously stored embedded history is preserved unchanged through ordinary card writes for schema compatibility.

## Notifications
- Header bell replaces the administrator's extra announcement strip. It shows actual new cloud reminder deliveries plus current group announcements, not invented status messages.
- Explicit links open the associated card/group; mark-all-read is stored against the authenticated account and restored on another device. Browser-local announcement acknowledgements are also respected.
- System push remains opt-in, using existing permissions/quiet hours/private-content settings and device binding. The bell links to those settings; it never asks permission on load.
- Account history starts when the administrator first loads the new bell. Earlier phone notifications cannot be reconstructed. Up to 100 recent reminder items are retained, and the latest 50 are returned. Multiple devices share one event entry. Test pushes are recorded after successful sending too.
- Server endpoints require verified administrator identity, ignore supplied user IDs, enforce read timestamps and account isolation, and cascade data on account deletion. A small additive D1 migration creates two private account tables and one index; it changes no existing records.
- Push delivery success remains independent from optional history-storage errors. Such errors log only a generic storage reason, not titles, bodies, prompts or credentials.
- The service worker informs open windows of new push activity. The UI refreshes on arrival, explicit open, reconnect or focus (throttled), and once a minute while visible for account activity on other devices. Hidden tabs make no polling request.

## Performance and interaction
- Removed the global administrator experience provider, its extra OfflineWorkspace/card feed and recurring processor. Relationship metadata is subscribed only while the board is open.
- Compact card details now mount on first expansion and stay mounted afterwards, preserving component/draft state. Hidden cards no longer build their detailed UI up front; sorting remains on the original handle.
- Short transform/opacity feedback, 44px control targets, visible touch/focus expansion controls and reduced-motion support. Removed blur from the admin board backdrop/canvas; existing colors and card appearance remain.
- Chromium local sample: 52 cards, 1,841 DOM elements, zero unopened detail headings, median and p95 frame interval about 16.7ms over 90 scrolling animation frames. Smaller sample also about 16.7ms. These are local browser measurements, not a before/after comparison or a guarantee for a physical phone.

## Verification
- Unit/application: 1,279 passed, 123 files (`.wrangler/simplify-unit.log`).
- Backend: 888 passed full suite; a further real-delivery integration test passed in the four-test notification suite, covering scheduler/queue/push/history, hidden content, access isolation, retention, deduplication and read state (`.wrangler/simplify-delivery.log`).
- Browser: 9 initial journeys passed (assistant compound request, desktop/phone card actions, ordinary accounts, original board/account restore/offline, bell read/reload/navigation). Two additional journeys passed: actual rope relationship selection/account reload and 50-heavy-card rendering/Arabic phone drawer. Network-provider history is injected in browser tests; server paths separately use actual SQLite and worker functions.
- TypeScript/production build passed. Lint has zero errors and one existing AssistantWidget cleanup-ref warning. Architecture has zero violations. Production dependency audit reports zero vulnerabilities. Source/dist credential pattern checks and Git-history pattern checks passed; these are not exhaustive secret scanners.
- Full Firestore rules/persistence: 689 passed across 17 files. Authentication recovery: all 4 passed (`.wrangler/simplify-rules.log`, `.wrangler/simplify-auth.log`). Deployment evidence is appended after completion.

## Known limits
- No physical phone push-delivery or live provider-quality test was performed. Phone browser emulation fits 390px. Actual system-push permission/installation requirements still depend on the browser.
- Existing Firebase/main bundle-size warnings remain. No unrelated architecture rewrite was attempted.
- PROJECT_ENGINEERING_GUIDELINES.md was applied. `docs/knowledge/university/university_rules.md` was checked and is absent.
- Automatic approval review rejected a broad folder move/deletion and mass import rewrite. It was not run. A safer scoped alternative keeps the compatibility files in place; the removed UI modules/services stay removed.

## Deployment and recovery
Publish only the verified administrator's bell/board adjustments. Use an additive D1 migration before worker code, preserve deployed vars/bindings, and publish hosting after production build. Retired metadata remains private and recoverable. No destructive database migration or production account test writes are needed.

## Current delivery status
Implementation and verification are READY; deployment is NOT COMPLETE. Automatic approval review rejected the shared production worker update because administrator-preview authorization was not considered sufficiently explicit for a shared backend. A specific approval question is pending. No workaround deployment was attempted. Hosting remains on the previous release. The additive notification-table schema was applied successfully before the rejection; it creates empty tables/indexes and changes no existing account content.

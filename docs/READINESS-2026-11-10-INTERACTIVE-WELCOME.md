# Interactive welcome journey — 2026-11-10

## Product behavior
Replaced the read-only eight-topic walkthrough with a short interactive journey: opt-in welcome, create a real personal card using the existing form, open and explore its tools, visit University, visit Groups, then choose whether to retain or delete tour-created cards. University and Groups are introductions; the tour does not automatically create courses, groups or invitations.

A code-native layered-paper companion follows Wilo's visual identity. Brief greeting animation respects reduced motion and Wilo motion preferences. The modeless coach can be minimized. On phone editing surfaces it yields space to the form/card and returns after closing. Native welcome/cleanup dialogs retain keyboard focus boundaries.

## Data and account integrity
- Existing OfflineWorkspace, entity validation, revision checks, Firestore rules, local queue and synchronization remain authoritative. No database schema, server endpoint, authentication or scheduler changes.
- `OfflineWorkspace.add` returns the actual newly queued card ID. Workspace publishes that receipt with the current UID only after successful creation; unscoped/cross-account events do not advance the tour.
- Session progress stores only step and bounded card IDs in project/account-scoped sessionStorage. No titles, notes, keys or credentials are stored in the journal.
- Cleanup requires an explicit user choice and a synchronized conflict-free snapshot. Only creation receipt IDs are considered; no title matching, account-wide clearing, group/course deletion or bulk reset.
- Deletes use current revisions through the existing repository; successful completion waits for the queue to drain and removal to appear in the persisted snapshot. Failed/conflicting cleanup retains the journal for retry or keeping remaining cards.
- Existing completion preferences remain respected. Replay is available in Settings. Switching accounts remounts the journey.

## Validation evidence
- Full application suite: 148 files / 1369 tests passed after correcting one stale university test deadline (its fixed date had become past on 2026-11-10; changed synthetic deadline to 2099).
- Updated journey/geometry/session focused tests: 9 passed after removing obsolete read-only tour copy and extracting viewport clipping.
- Emulator-backed Chromium journeys: desktop English and phone Arabic both passed; actual card creation, persisted content, opening the card, University/Groups navigation, keep/delete choices, preservation of earlier personal cards and reload persistence.
- Screenshots visually reviewed for desktop and phone viewports.
- Final production build, lint, architecture/credential checks and production asset parity are release gates recorded in external build/proof logs.

## Limits and recovery
Phone checks emulate a Chromium viewport; no physical handset check. No production account content was inspected or changed, and no live Push was sent. Existing public API, reminders, Chrome extension, Google login and security rules were not changed. The tour creates real user-chosen cards only after the user submits the normal form.
Recovery and production proof: /home/adam/wilo-recovery/20261110-interactive-welcome/. Existing /home/adam/wilo-test remains untouched.

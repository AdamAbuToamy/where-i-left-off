# Desktop planning board — 2026-11-04

Status: **READY for the verified-administrator desktop rollout; deployed.**

Release: `wilo-admin-planning-board-20261104` at https://where-i-left-off.web.app.
Production proof: `2026-11-04-planning-board-production.json` (18 deployed files matched the local tested build byte-for-byte). Firebase CLI compiled and released the additive Firestore rules successfully.

## Requested behavior and scope

Verified administrator accounts only. Restore the previous envelope cards and sortable main list, replace the automatic pinboard with an explicitly opened desktop canvas, and compact the workspace controls. The animated title underline exists only inside the canvas. Public account styling, authentication, assistant/provider configuration, and existing data stay intact.

## Architecture decision

Use MIT React Flow 12.12.1 for free placement, pan/zoom, keyboard selection and manually dragged connections; RoughJS 4.6.6 for user-drawn tidied circles; existing Rough Notation for the title hover underline. Keep their licenses in public/licenses and retain React Flow attribution. No board runtime is precached or rendered on phones.

The domain owns bounded canvas validation and circle recognition. The application repository receives explicit local/remote/account/identifier/scheduler ports, journals edits before accepting them, uses revision-checked atomic snapshots, preserves queued edits across reload, and requires an explicit choice on concurrent changes. A browser adapter alone accesses Firestore and localStorage. No board adapter receives a project write path.

Each user's personal and group-scoped canvases are private account data in users/{uid}/planningBoards, not shared group state. They contain project references, never copies of project content, plus board-only notes/positions/threads/circles. Deleted or inaccessible cards are hidden. Board removal does not delete project records or change their ranks. Personal-data export includes this collection; the existing account-deletion processor recursively removes the user tree.

Firestore rules are additive, owner-only, require an active account and verified writer, bound payloads/fields, enforce revision increments and current group membership for group writes. Client/domain decoding also validates the serialized structure. No migration or original-data rewrite is needed.

## Evidence collected

- Full unit/application suite: 1277 tests / 121 files passed.
- Focused domain, journal, conflict and service-worker tests: 11 passed after the latest repository/SW changes.
- Architecture: 24 modules, zero boundary violations.
- Full rules/persistence suite: 684 tests / 16 files passed, including 4 new planning rules tests (Java 21 emulator).
- Authentication recovery: 4 passed against the auth emulator.
- Backend: 885 passed; no backend source changes.
- Production dependency audit: zero reported vulnerabilities.
- Browser: 6 targeted Chromium journeys passed. They cover original desktop/phone cards, Arabic phone search layout, ordinary-account isolation, no phone canvas-runtime request, rapid note typing, free positioning, manual ropes, circles/undo/redo, cross-context account restore, offline reload/resync, and board removal preserving the source card and main ordering. No live provider was involved.
- Fixed a genuine lost-keypress defect: replacing React Flow nodes discarded measured dimensions, temporarily hiding the active textarea. Preserve the measured properties during state updates. The note editor now uses the accepted state directly rather than a duplicate draft/mirroring effect.
- TypeScript and production build passed. Lint: zero errors, one existing unrelated AssistantWidget warning. Credential pattern scan including dist passed. Production bundle-size advisory remains on existing root/Firebase chunks.
- Screenshots inspected: desktop canvas, title hover underline aligned beneath the title, Arabic phone cards/search. Captured screenshots are local ignored artifacts, not private production account content.

## Verification limits

Browser checks used isolated emulator fixtures and Chromium desktop/mobile emulation. Production verification was read-only and compared shipped files, not an authenticated real-user write journey. No physical phone, live model, microphone, app-store, Google indexing, or external-provider tests are claimed by this UI task. The university knowledge rules file requested by AGENTS.md is absent in this checkout. Existing unrelated assistant test reports were preserved.

Board limits: 200 items, 400 manual connections, 120 circles, 2000 characters per sticky note, 150000 serialized characters per canvas. A group-scoped canvas belongs to its user; this is not a shared collaborative group whiteboard.

## Rollout and recovery

Keep the UI behind the existing verified administrator gate. Deploy the additive rules together with Hosting after checks. Previous release metadata is saved in .wrangler/planning-release-before.json. A Hosting rollback restores the previous UI without modifying projects or deleting board documents. The new collection may remain dormant; avoid deleting user notes as part of rollback.

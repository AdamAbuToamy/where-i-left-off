# Admin Studio readiness — 2026-10-27

## Acceptance scope
Admin-only route: `https://where-i-left-off.web.app/#/admin/studio`. Existing public pages remain the default. No production data writes, database migration or rules weakening.

| Approved area | Implementation |
| --- | --- |
| Visual foundation | Scoped teal/ivory design, dark rail, Lucide icons, Motion transitions, dark mode, RTL/LTR, reduced motion, responsive navigation and loading/empty/error states |
| Daily work | Today dashboard, contextual resume, project cards/list, status/section/search URL state, drag and keyboard ordering, bulk operations, archive/trash/review, focus sessions and measured analytics |
| University | Compact searchable course navigator, selected course identity, semester assignment/archive, course overview and linked notes/materials, study plan/prerequisites, course-labelled deadlines, paginated tasks, day/week agenda with conflict indicators, ICS export |
| Assistant | Contextual dock/mobile panel, conversation persistence, thread management, cancellation, normal conversation first, reviewed compound proposals, human-readable changes, atomic apply, affected-record links and undo |
| Recovery/delivery | Private journal, twenty undo/redo snapshots, checkpoint, validated backup/import, read-only account copy, corrupted-cache recovery, account isolation and public regression checks |

## Verification evidence
| Check | Result |
| --- | --- |
| `npm test` | 1162 passed across 98 files |
| `npm run test:rules` (Java 21, Firestore emulator) | 675 passed across 14 files |
| `npm run test:auth:recovery` (Auth emulator) | 3 passed |
| `node --test push-worker/*.test.mjs` | 867 passed |
| `node scripts/run-browser-tests.mjs` | 45 Chromium journeys passed, including 7 new Studio journeys |
| `npm run check:architecture` | 7 roots, 20 runtime modules, no violations |
| `npm run lint` | No errors; one pre-existing AssistantWidget warning |
| `npx tsc -b` | Passed |
| Credential pattern scan | Passed; a pattern check, not a comprehensive secret audit |
| Production build | Passed, existing public chunk-size advisory remains |

Browser coverage includes all Studio screens in Arabic/Hebrew/English at desktop/phone widths, dark mode, reduced motion, keyboard navigation, an axe WCAG2/2.1 AA check, cross-tab updates, atomic apply, cancellation, read-only account copy, corrupted-cache recovery, ordering and public-account isolation. Saved desktop/phone screenshots were visually reviewed. The final CI must pass again on the exact merged source before Hosting deployment. Do not interpret this preview as a new live-provider acceptance result.

## Explicit limitations
- Browser-local experiment; it does not synchronize preview edits between devices or write them to the account.
- Preview group creation does not invite actual people; preview reminders do not schedule real push notifications. Both are labelled in the interface.
- ICS calendar download is implemented. Automatic Google Calendar synchronization is not enabled.
- Assistant tests use injected provider responses through the real adapter. These verify contracts, memory and persistence, not accuracy/latency of every live model response. No new 618-prompt live run was performed for this UI change.
- Real Google/Pollinations OAuth consent, physical phones, Safari/Firefox, store installation and real push delivery are not newly certified by Chromium/emulator tests.
- Local storage has a bounded journal size; oversized writes fail without overwriting previous data. JSON backups should be downloaded before clearing browser data.
- Existing public bundle-size warning and pre-existing AssistantWidget lint warning remain architecture debt; the redesign is split into private lazy chunks rather than rewriting the working public application.

## User rollback
Leave via **Back to administration**. Undo/redo reverses private actions; Settings can save/restore a checkpoint, export/import a JSON backup, or reset demo data. Resetting a malformed cache first preserves the raw cache in a separate recovery slot. Production rollback is a revert through the existing CI/deploy workflow; no data migration is required.

# Administrator productivity additions — 2026-11-04

## Scope and decision
READY for administrator-only use. Published release: `wilo-admin-ten-additions-20261104` at https://where-i-left-off.web.app. All ten additions are enabled only for the verified administrator. Existing ordinary-user flows remain available. No live account content was edited for testing.

## Ten independently implemented capabilities
1. Inbox: text/link capture and deliberate, retry-safe creation of a real personal card. Extension/share capture is intercepted for the administrator only.
2. Resume: selected daily top three, valid last-session source, checkpoint/next step, waiting cards and direct work sessions.
3. Relationships: related/part/dependency links, cycle rejection, card tools and explicit rope semantics for card-to-card board links.
4. Work-time planning: estimates and drag-to-day preparation; timetable/block conflicts require explicit review. Original due dates remain separate.
5. Follow-up/review: explicit follow-up, stale/waiting suggestions, review snooze, continue/archive. Snooze changes review metadata only.
6. University: course checkpoint and next step, reviewed exam-plan study tasks, assignment effort and remaining time, topic resources and optional weighted grades.
7. Assistant: validates the actual open-card/course reference, preserves pending proposal history and requires existing Apply validation. New hub-only operations have honest UI handoffs rather than invented AI tools.
8. History: confirmed personal-card content versions, actor/source, bounded last 20 snapshots and review-before-restore with expected revision. Restore preserves identity/order. Permanent deletion has no unsupported undo.
9. Templates/repeat: built-in/custom templates and daily/weekly/calendar-correct monthly recurrence; deterministic occurrence IDs. Automatic generation is opt-in, runs when opening the app while synchronized, creates the latest due occurrence and discloses skipped older occurrences. No server cron is claimed.
10. Boards: named private scoped boards, explicit archive/reopen, existing undo/redo, actual PNG/PDF download and note-to-card conversion retaining pin position and threads. Desktop only; undoing the canvas conversion does not delete the created real card.

## Architecture and security decisions
- Shared revisioned journal extracted from the existing tested planning repository because the hub needs the same CAS/offline/conflict semantics. Ports and codecs are explicit; existing planning contracts/error codes are retained.
- **ADR: embedded history.** Separate immutable history documents would add per-card rule reads and endanger 50-action atomic saves. History now lives inside each personal project document, bound to the same revision/mutation and actor, bounded by count and size. An attempted weakening of the former cross-document binding was rejected by automatic approval review; it was not applied. This replacement retains atomic integrity without extra cross-document history reads.
- Metadata uses an account-private administrator-only Firestore document with a revisioned local journal. Payload is bounded to 250,000 JavaScript characters (conservative UTF-8 size under the Firestore document limit). Named boards retain their own journals. Ordinary users cannot write preview metadata.
- Existing OAuth/provider encryption, authentication domains, account isolation, domain validators, offline queues and atomic assistant writes are preserved. No provider/model change is included. The conditional admin-context instruction was deployed to worker version a9ca43da-3867-4dc4-a6f5-ef423a3e0ab7 after comparing all active plain-text bindings (no changed values); --keep-vars preserves deployed settings and secrets.
- html-to-image 1.11.13 (MIT) is added only for explicit board export; its license is distributed. Preview panels and desktop canvas/export chunks are excluded from initial service-worker precache.
- Required knowledge source `docs/knowledge/university/university_rules.md` was checked and is absent. PROJECT_ENGINEERING_GUIDELINES.md was read and applied.

## Verification evidence
- Full unit/application: 1,292 passed across 131 files (`.wrangler/ten-final-unit.log`).
- Focused browser acceptance: Inbox capture/card conversion/account restore and ordinary-user exclusion (2); priorities, cycle refusal, class conflict review, review snooze, course tasks/grades/reload, revision restore and manual repeat (7); named board, note conversion and real PNG/PDF downloads (1); injected assistant context/Apply, automatic repeat after reload and deleted-source session exclusion (3). Earlier course selector failure was corrected with explicit accessible names and rerun successfully.
- Architecture check passed for all new pure capability modules. Backend: 885 passed. Production dependency audit: zero vulnerabilities.
- Full Firestore rules/persistence: 688 passed in 17 files (`.wrangler/ten-final-rules.log`), including a 50-card atomic history batch. Additional focused run: all 5 administrator metadata/history/named-board security tests passed (`.wrangler/ten-named-board-security.log`); the named-board access case was added after the full suite.
- Authentication recovery: all 4 passed (`.wrangler/ten-final-auth.log`).
- Browser: 21 distinct Chromium journeys passed across focused runs. Final affected acceptance run passed 11 and exposed 2 obsolete hover interactions; both were corrected to perform real card hover/expand and passed their rerun (`.wrangler/ten-last-browser.log`). Existing desktop/phone cards, ordinary-user design and 3 old planning journeys passed. Arabic phone hub fits 390px and does not request desktop board chunks. This is emulation, not a physical device.
- Backend full suite: 885 passed; 1 additional native admin-guidance contract passed (`.wrangler/ten-worker-preview.log`), proving ordinary request tools remain identical.
- Lint: zero errors, one pre-existing AssistantWidget cleanup-ref warning. Architecture: 37 checked modules, zero violations. TypeScript and production build passed. Source/dist credential patterns and Git-history secret patterns passed (pattern scanners are not exhaustive). Production dependency audit found zero vulnerabilities.
- Existing Vite chunk-size warnings remain for Firebase/main; optional hub panels and board export are loaded lazily. No unsupported performance guarantee is claimed.
- Deployment succeeded for Hosting and Firestore rules. Read-only production verification matched all 29 checked files byte-for-byte (index, service worker, release/config files, feature chunks and export license). Evidence: `docs/readiness/2026-11-04-ten-additions-production.json`. No production-account content writes were made. Previous published release metadata is saved locally in `.wrangler/ten-release-before.json` for recovery.

## Limits and recovery
- New workflows primarily target personal cards. Existing group collaboration remains intact; named boards can be group-scoped but remain private administrator planning metadata. Sticky-note conversion is available on personal boards only. Group audit history is not promised.
- New panel text is Arabic/English; Hebrew may fall back to English. Existing Hebrew application behavior remains available.
- No live-provider acceptance, physical-phone/store test or simultaneous real-device recurrence test is claimed. Injected provider tests establish request/context/apply integration, not remote model quality or quota availability.
- PNG/PDF board export is an image of the board, not editable vector content.
- This release is not a public-feature rollout. Reverting the frontend to the saved previous release disables new UI without deleting stored cards/metadata. No destructive migration runs. Rules retain old document compatibility and require explicit admin scope for new metadata.

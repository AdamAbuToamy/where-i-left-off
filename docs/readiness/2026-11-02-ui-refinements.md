# UI feedback corrections — 2026-11-02

READY for the scoped corrections, runtime commit 2645a54.

## Requested outcomes

1. Bootstrap loading now renders the same LoadingScreenView and exact LoadingScreen.css as the existing React loader, generated at build time for English/Arabic/Hebrew. The old standalone animation has been removed. Native locale preference is applied before body paint, and no-JavaScript fallback remains. No artificial startup delay or loading-stage timer was introduced. The view and its colors/animation now have one source; this is not a claim of preserving CSS animation phase across React mounting.
2. Admin card-status, course and university-day selectors use a compact custom ChoicePicker, with portal placement, selected state, arrow/Home/End/Enter/Escape/Tab support, outside click, native touch/click and reduced-motion animation. Ordinary users retain their native selects.
3. Admin personal-week view has wider day columns (minimum 160px), taller days (310px), a wider workspace (up to 1480px), and a contained horizontal scroll region. University week columns/viewport are also larger. Days are not dropped to fit a narrow screen.
4. Undated cards are in a collapsed-by-default list with a count and accessible summary; all names and next steps remain available when expanded. University agenda cards have solid surfaces, clearer time/name hierarchy and mobile layout.
5. Recent work-session rows are joined to accessible, non-trashed current card IDs using both group and card identifiers. Missing/deleted cards no longer leave named rows in My progress. Session records and historical time totals are preserved; restoring a card can restore its row. Lists wait for task overview readiness rather than flashing cached orphan names.

The visible design changes remain gated to the opted-in admin design. Shared bootstrap and the session-list correctness fix apply to the existing public app. No changes to account auth, permissions, schemas, journals, offline queues, model inference or proposal validation.

## Evidence

- npm test: 1237 passed in 113 files.
- Architecture: 22 modules, no violations.
- Browser emulator group: 6 passed: delayed bootstrap and replacement, JavaScript disabled, combined card/weekly/filter/session-delete/university journey, existing university persistence/navigation/UML and regular-account journeys. After the final course-picker/mobile-card polish, the combined journey passed again (1 test). These are run counts, not seven unique tests.
- Combined journey records a real disposable work session, observes it in analytics, trashes its card through the normal confirmation UI and verifies its session row is hidden after overview readiness. It also tests custom picker keyboard actions, 7 enlarged week columns, collapsed undated rows, university import/day selection, solid agenda backgrounds and phone overflow.
- Screenshots of bootstrap and desktop/phone university were visually inspected.
- TypeScript, lint, production build, route-bundle check and credential-pattern scan passed. Lint retains one pre-existing AssistantWidget warning; production still warns of large vendor chunks.
- Initial browser attempts exposed test-selector issues (closed view-tools/main university tab) and fractional-pixel measurement; final assertions use the real user controls and rounded CSS-pixel measurement. No business invariant or validator was relaxed.
- Rules/backend/auth-recovery suites were not rerun for these UI/read-projection changes; browser sign-in and existing permission boundaries remain. Live AI, physical-device/store and production account writes were not performed.

## Publication and rollback

Hosting-only publication is verified separately in the adjacent production proof JSON. Restore original remains available for the admin design; restoring the prior Hosting release reverts bootstrap/read-projection code without data migration. The university knowledge file named by AGENTS remains absent; it was not claimed as read.

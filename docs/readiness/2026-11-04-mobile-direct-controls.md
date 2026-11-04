# Direct controls and phone workspace — 2026-11-04

## Scope
Administrator-only UI preview. No worker deployment, model/provider, Firebase rules, account credentials or data schema changes.

- Cards/week, card-state filter and section selector are available directly in the command strip. Group ownership filters are direct too. Export and section maintenance remain in the small More menu. Ordinary accounts retain their current controls.
- The computer notification drawer has no phone-install/enable prompt. Its account settings remain reachable through the settings icon. The phone link is styled as an action rather than a bare hyperlink.
- Phone compact cards use shorter summaries, one-line title/next step and an explicit 44px Open target. The original drag handle still reorders cards. Full text remains available in details.
- Optional phone single-card mode displays one centered card. Horizontal pointer/touch swipes and Previous/Next buttons change the selected card only; they do not edit ranks, delete cards or change status. Vertical scrolling and form controls are excluded from swipe handling. Reduced motion is supported.
- Phone bottom navigation exposes Cards, University, Wilo, Week and More. Wilo is the prominent center action; the old floating phone launcher is replaced by this entry, while the desktop launcher remains unchanged. A small account-scoped command bridge retains the first tap while the assistant lazily loads.
- The existing menu opens above the bottom bar. Language and sign-out move there on phones using the same existing callbacks, freeing the header for the brand and notification bell. The Chrome-extension promotion stays out of the phone work area and remains in Settings.
- Phone card details/editing and new-card entry fill the viewport with Back controls. Their controlled state remains in the original component; portals avoid transformed page ancestors constraining fixed geometry. Pending disabled fieldsets are carried across the portal boundary. Background DOM siblings are inert while editing; body scrolling is restored on close.
- Site dialogs and application pickers use full-screen phone presentation. Native OS/browser permission dialogs are outside this control. Wilo stays above the bottom bar; the bar hides while the chat is open.

## Engineering and validation
- Existing domain validators, revision checks, offline queues, group permission checks and Apply semantics are retained. No new model tools or automatic actions.
- UI state is explicit and separate from persistent card ordering/content. No new dependency was added.
- PROJECT_ENGINEERING_GUIDELINES.md applied. The university knowledge rules file is absent (previously checked); no university-domain behavior was modified.
- Full unit/application: 1,281 passed in 124 files (`.wrangler/phone-final-unit.log`). Final affected card/form/permission/launcher recheck: all 7 passed (`.wrangler/phone-final-focused.log`).
- Final browser set: all 9 Chromium journeys passed (`.wrangler/phone-final-browser.log`): desktop/phone original actions, ordinary-user design, new bottom bar/assistant/swipe/full-screen add/edit, notification read/reload, dense cards/Arabic phone, direct desktop view/filter/sections, compact phone/drag handle. The full phone journey passed again after final portal/error/styling adjustments (`.wrangler/phone-final-last.log`).
- Actual bounding-box checks confirm card details/editing and new-card entry fill a 390×844 emulated phone. The phone journey edits a real emulator card, saves it, returns to the same selected card, opens/closes New card, switches back to compact mode and uses the bottom More menu.
- TypeScript and production build passed; lint zero errors with one pre-existing AssistantWidget cleanup-ref warning. Architecture: 29 checked modules, no violations. Source/dist credential pattern checks passed. No new dependencies.
- Earlier test failures caught a first-tap lazy-loading race, native text selection blocking a mouse swipe, and a transformed ancestor constraining a full-screen form. These were corrected; no unsafe validator/rule relaxation was used.
- Failed save callbacks retain entered values and display feedback inside the phone surface instead of relying solely on an obscured background notice.
- Physical-device keyboard, Android/iOS system Back, system notification permission and store installation remain manual-device checks; browser emulation cannot establish those behaviors.

## Rollout
Publish the verified administrator preview only. Keep production assistant connection/provider metadata and worker version unchanged. Read-only deployment byte comparison is recorded separately. No production-account fixture writes.

## Release status
READY and published to the verified administrator only: `wilo-admin-mobile-ui-20261104` at https://where-i-left-off.web.app. Hosting deployment completed. Read-only verification matched all 16 checked production files byte-for-byte and confirmed real production push configuration (no emulator endpoint). Evidence: `docs/readiness/2026-11-04-mobile-production.json`.

Existing worker version `4b4503ea-1384-49c6-9f4c-25d86d3bfcad`, provider connection settings and Firestore rules were unchanged. No production-account test content was written. Previous release metadata remains in `.wrangler/mobile-release-before.json` for recovery.

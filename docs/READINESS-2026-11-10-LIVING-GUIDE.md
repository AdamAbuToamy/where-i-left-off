# Travelling welcome companion — 2026-11-10

## Behavior
Replaced the fixed coach panel with a free-standing paper companion and a small speech bubble anchored near actual controls. The guide observes the real new-card form and changes one-sentence instructions between the create button, title field, next step and save button. Opening the created card reveals a reminder-control introduction. The university/group introductions are concise and intended for a first-time visitor in Arabic, English and Hebrew.

The companion breathes, blinks, gestures and changes facial expression by activity. Motion uses small local SVG/CSS transforms, stops when the guide is unmounted, and respects both reduced-motion media preferences and Wilo motion settings. The speech bubble can be minimized. Position selection avoids covering its target and, when space allows, the card being introduced. A constrained visual viewport uses smaller guidance.

On phone forms/cards and native dialogs, the guidance portal resides within the active surface so it remains accessible rather than inert behind it. No automatic submission or focus theft is added. Form values are inspected locally only to pick a cue; no content is logged or added to the tour journal.

## Integrity
Existing real-card creation, account-scoped creation receipts, skip/replay, progress recovery and explicit keep/delete choice are unchanged. No backend, API, reminders, database, auth, scheduler or Chrome extension changes.

## Evidence and limits
Full application suite: 148 files / 1372 tests passed. Focused guide/geometry suite: 10 passed. TypeScript, lint, architecture and production build passed. Emulator browser journeys passed on desktop English and phone Arabic, including real card creation, live guidance inside the form, keep/delete isolation, navigation and reload. Browser checks verify infinite companion animation when enabled and no animation under reduced motion. Desktop/phone screenshots reviewed.
Phone checks emulate Chromium; a physical keyboard/handset has not been tested. Public production verification compares deployed assets with the reviewed build; it does not create account data or send Push.

Recovery/proof location: /home/adam/wilo-recovery/20261110-living-guide/.

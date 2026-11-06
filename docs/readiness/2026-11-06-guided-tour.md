# Full-site spotlight tour — 2026-11-06

## Scope and behavior

Replaced the six-step first-card-only strip with a read-only guided walkthrough: 25 ordinary desktop stops, 24 phone stops (desktop board omitted), plus an authorized-admin-only stop. Arabic, English and Hebrew share identical route/target contracts and localized text. Coverage includes cards/creation/details/work sessions, search/sections, card week, desktop planning board, Resume, courses/tasks/timetable/prerequisite map, groups, archive/Trash/review, analytics, notifications, assistant and export capabilities, profile/appearance/workflow/install/data controls, and Support/privacy links in the footer.

Steps navigate the existing hash routes. Settings accordions are opened only for presentation and restored when the step ends. The tour never simulates clicks on app action buttons, creates cards, invokes a provider, toggles a preference, requests notification consent, exports data or runs deletion. Existing page subscriptions continue normally. Existing local per-UID v2 completion preference remains; previously completed users are not forced through the enlarged tour. Replay is in Settings.

A viewport spotlight leaves the target clear, with a dimmed scrim and actual blur on sibling branches. The explanation uses larger readable type, step counter, progress bar, Previous/Next, chapter index, Escape/end and an explicit Explore exit. Ring geometry and copy transitions are brief and respect reduced motion. Positioning bounds, RTL counters and nested scrolling are handled for phone/desktop/landscape. Missing-data targets fall back to the current page rather than blocking advancement.

Background branches become inert while the modal explanation is active. Keyboard focus is contained and restored on exit. Original inert/filter/overflow state and accordion presentation are restored; temporary DOM effects are not saved as app preferences. Explicit replay waits for active native/card/phone editors to close, rather than navigating away from drafts. Extension captures do not auto-start onboarding. ExtensionInstall/ProfileSettings gained only stable target attributes, without changing actions.

## Evidence

- `npm test`: 1302 passed, 129 files.
- Targeted tour/accessibility/geometry: 8 passed, including exact localized close labels, dismissal/replay, isolation cleanup, open-editor deferral, extension capture protection, bounds, feature coverage and locale contract parity.
- Two Chromium emulator journeys passed in 19.6 seconds: English 1440x1000 desktop and Arabic 390x844 touch phone. Traversed 49 stops across seven route families, university/card/library query views, Previous and chapter jumps; checked visible focus, popover bounds, settings disclosure, inert/filter restoration, Tab/Escape, zero model completions and unchanged seeded personal-card count.
- Inspected `.wrangler/tour-ar-create.png`, `tour-en-appearance.png` and other timetable/appearance snapshots.
- Architecture passed, 29 checked modules. Lint: zero errors, one existing AssistantWidget cleanup-ref warning. Production TypeScript/Vite build and credential pattern check passed; existing large-chunk warning remains.
- No backend, authentication, rules, persisted app schema or model configuration changed. Rules/auth-recovery/backend suites were not rerun for this UI-only change.
- Referenced university knowledge rules file remains missing; no claim of reading it.

## Limits and delivery

Phone checks are browser emulation, not physical-device/frame-rate or Safari checks. Hebrew has localized unit/contract coverage, not a separate full browser journey. Empty-account explanations describe features before data exists; the tour does not manufacture sample records. Support is explained through its actual footer links. Production validation is read-only version/asset comparison, not authenticated production mutations.

Hosting-only release: `wilo-guided-tour-focus-20261106-r2`; see matching production proof. Previous release can be restored through Hosting; this change introduces no persisted board/schema migration.

### Explore handoff polish

Explore intentionally keeps the selected settings group open after ending guidance, and focuses its container without activating a save/selection button or opening the phone keyboard. Other exits restore prior presentation and focus the main landmark when the original trigger no longer exists. Selecting the current index entry also restores heading focus. Focused unit and browser checks were rerun after this refinement; the general suite result above precedes this final handoff polish.

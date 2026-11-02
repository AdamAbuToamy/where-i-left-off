# One final account design — 2026-11-02

READY for the scoped correction. Runtime commit 2f74d2f.

Removed the design-management panel, its buttons/translations/styles, preference subscriptions and setter API. Every signed-in account now always gets the approved design. An old per-account wilo-design-preview preference is ignored and cleared when that account mounts; off cannot select another design. No alternate authenticated design can be selected. Existing signed-out auth presentation and underlying component styles are retained where needed for login and feature rendering. Sign-out still clears the account-design attribute.

Verified eight focused unit tests and six Chromium/emulator journeys: admin and ordinary accounts deliberately seeded with legacy off before every load, reload behavior, absence of the management panel and both switch buttons, ordinary-account admin exclusion, normal desktop/phone public design, card expansion and real drag/reorder persistence. TypeScript, lint (zero errors, one prior AssistantWidget warning), production build, credential pattern check and route-bundle check passed. Obsolete browser flows no longer depend on the removed Explore/Restore controls.

No account content or journal deletions, auth/rules/worker/domain/schema changes. Only obsolete visual preference keys are removed locally. Backend/rules/full unit suites, physical devices and live AI were not rerun for this focused removal; no production account writes occurred. Hosting-only publication and exact build match are recorded in the adjacent proof JSON. Global rollback remains an operational Hosting release restore, not a user-visible old-design option.

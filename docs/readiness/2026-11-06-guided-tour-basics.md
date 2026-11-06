# Guided tour simplification — 2026-11-06

Release: wilo-guided-tour-basics-20261106.

Removed the administration stop from every language and account. The tour now has eight desktop stops and seven phone stops: cards, creation, details, week, desktop board, courses, assistant, appearance. Existing spotlight/blur/focus navigation remains. Localized animated examples are isolated decorative markup: no forms, model requests, synthetic app actions or persistence. Reduced-motion preference disables example animations.

Verified: eight focused unit tests; two Chromium journeys (English desktop and Arabic phone), 15 stops, 18.3 seconds. Journeys check bounds, navigation, focus restoration and unchanged seeded card count with zero model completions. Screenshot of Arabic phone creation step inspected. Lint, architecture and production TypeScript/build/credential checks recorded in local logs. Existing AssistantWidget lint warning and build chunk-size warning remain.

No backend, rules, authentication or saved application schema changes. Those suites and the full general unit suite were not rerun for this refinement. Physical phones and Safari not tested. Referenced university knowledge rules file is missing. Previous detailed tour report describes the superseded 25/24-stop release.

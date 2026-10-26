# Streaming inference and explicit core boundaries
Date: 2026-10-26
Status: accepted for the current implementation

## Context
The previous transport waited for an entire JSON reply and expired active generations at a fixed deadline. A legacy proposal-repair path also imposed a backend-specific 3.2-second delay and counted browser-local course bodies as outbound model input. The readiness review found outdated provider fixtures, browser APIs inside offline orchestration, and CI deployment jobs that still selected the retired owner-only Gemini pilot.

## Decision
- Receive Pollinations' documented SSE format, assemble UTF-8 and interleaved typed tool calls, require a complete terminal reply, and validate the complete proposal before Apply. No partial streamed operation is executable.
- A 25-second quiet connection expires. Real output extends its idle allowance, subject to a 60-second hard request limit, explicit cancellation and a whole-chat request budget.
- Retry at most once for allowed transient HTTP/network errors before output. Do not restart a partially received generation or retry writes.
- Keep bounded provider bodies, typed response mapping and non-sensitive stage timings in the adapter. Diagnostics contain durations, byte/character counts and status codes, never keys, prompts or account contents.
- Remove the obsolete backend delay only for direct user-key transport. Mark local snapshots explicitly so bounded format repair does not reject data that never leaves the browser in full.
- Separate university state/validation from its browser store, and appearance catalogs from persistence/DOM updates. Keep compatibility exports and the existing storage schema/keys.
- Inject the workspace lock and connectivity ports at createWorkspace. The application coordinator no longer imports Web Locks, window events or navigator.
- Guard the reachable business/application core with an AST-based runtime-dependency check in CI. Type-only DTO references remain permitted.
- Hosting CI retains App Check, requires current-main quality checks, and does not deploy or require a shared Gemini credential. The existing push Worker is unchanged.

## Alternatives
Increasing a fixed timeout alone leaves users without evidence of progress. Executing partial tool calls risks incomplete requests. Replacing the model without measuring introduces new quality and permission risks. A full rewrite, generic repository hierarchy or service bus is unnecessary for these boundaries.

## Compatibility and rollout
Existing browser-local state and Firestore documents keep their formats. University and appearance imports retain compatibility facades. The lock/connectivity constructor changes are internal and all production composition roots are updated. Deploy Hosting only after automated checks; no database migration or production test writes are required. Roll back with the previous Hosting version; persistent data is not migrated or deleted.

## Remaining operational limits
Free-provider latency/quota remains external. The three live scenarios are transport/behavior regressions, not a fresh 618-prompt live-model certification. Browser/emulator tests cannot establish real Google/Pollinations consent, physical-device push delivery, or Chrome Web Store installation. Generated PDFs currently render readable page images and are not searchable text.

## Tooling assessment
Production dependency audit found no advisories. Safe dependency fixes removed high-severity tooling findings. The current Firebase CLI still brings five moderate development-only advisory entries through telemetry/Google client dependencies. Avoid npm audit fix --force: its proposed downgrade crosses a CLI major version. Keep these findings in the readiness report and recheck upstream; they are not shipped in the browser bundle.

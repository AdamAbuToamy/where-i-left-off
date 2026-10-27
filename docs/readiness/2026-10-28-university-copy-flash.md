# University copy flash and task header cleanup — 2026-10-28

## Behavior and boundaries
Routine connecting and successful-sync sentences were still rendered during state transitions; CSS hid only the settled sentence. Do not render either sentence. Keep the existing status node with an explicit synchronization-state attribute for verification, hide the empty node with the native hidden attribute and a scoped CSS rule, and retain visible queued-change/error text and retry controls. No timing delay, persistence, offline, authentication or synchronization-policy change.

Remove the course-name row from every task header. Course context stays in the page heading, course picker, next-deadline summary and accessible task label. Task titles, source descriptions, notes, due dates and actions are preserved. New application-source changes stay inside `src/university`.

## Verification
The unit regression changes the injected sync state from connecting through ready, queued and error without loading CSS: ordinary messages never exist in the DOM; queued/error notices remain available. A task regression verifies course context above the task and in its accessible label without repeated header text. The browser observer checks removed copy through DOM mutations during loading/navigation/reload, verifies no task-header course label and checks the settled status node is hidden. Existing browser sync checks use explicit state instead of matching a removed sentence.

Local and exact-head CI/deployment evidence is recorded before publishing. Browser tests use disposable emulator accounts and injected provider responses. Production verification is read-only. No schema migration or account-data edit is required. Reverting the release restores the preceding presentation only; real user edits remain intact. Physical-device and other-browser behavior is not newly certified.


## Local evidence
- `npm test`: 1134 passed / 95 files.
- Focused Chromium/emulator journeys: 7 passed (University, persistence/reload, linked notes/UML/mobile views, injected-provider timetable and temporal copy observation).
- TypeScript, architecture, lint, production build and diff/scope checks passed. One unchanged AssistantWidget lint warning and the existing bundle-size advisory remain. Credential-pattern scan passed for 638 source/asset files.
- Source comparison confirms no changes outside `src/university`.
- Full browser, rules/persistence, auth recovery, worker and dependency checks run through exact-head CI before merge. Live source-fingerprint and read-only production checks are recorded on the release PR after deployment.

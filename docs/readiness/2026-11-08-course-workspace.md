# Focused course workspace — 2026-11-08

Admin-only course view: search above the workspace, course rail on the right with return-to-all action, task canvas in the center, course section navigation on the left. Compact course title/edit action. Upcoming class and notes are removed from the overview; schedule/dashboard and Materials retain them. Phone uses a horizontal section bar.

Existing filtering, pagination, editors and persistence callbacks retained; ordinary accounts unchanged. No backend/rules/schema changes.

19 focused tests and two Chromium emulator desktop/phone journeys passed (11.4s), including relocated search, course details, no upcoming-class overview, task editor and schedule navigation. Desktop screenshot inspected. Types and lint passed. The first browser invocation was interrupted; a clean rerun passed. WSL then terminated during production build; it was recovered and build rerun. Final build/architecture/credential checks accompany publication. Full rules/backend suites, physical devices and live providers not retested. Existing bundle warning remains.

Release wilo-course-workspace-20261108. Hosting only, admin trial.

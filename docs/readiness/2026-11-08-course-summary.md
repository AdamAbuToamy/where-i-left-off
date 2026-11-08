# Course summary and tools refinement — 2026-11-08

Admin-only changes: course map is an independent header action. Backup restore retains the existing validated file/import preview flow, with a labeled native picker hidden visually instead of exposing the raw browser control. The actual input remains keyboard accessible.

Course overview now presents linked tiles for study progress, next future deadline, saved materials and completed tasks, plus expandable course description/prerequisites when present. Values derive from existing account data; no generated or invented summaries. Open/overdue counters moved to Tasks and deadlines, and the task list no longer duplicates the overview. Each tile opens its related existing section. Ordinary presentation unchanged.

19 focused unit tests passed. Two Chromium Firebase-emulator desktop/phone journeys passed in 12.8 seconds, including backup confirmation, course selection, four overview tiles, no overview task counters, tile navigation to Tasks and back, task editing and timetable navigation. Desktop screenshot inspected. TypeScript, lint excluding transient Playwright artifacts, architecture and production build/credential checks accompany release. Full rules/backend suites, real devices and live providers were not repeated. No backend/persistence/rules changes. Existing bundle warning remains.

Release wilo-course-summary-20261108. Hosting only, verified-admin trial.

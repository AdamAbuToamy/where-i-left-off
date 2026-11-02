# Admin automatic header correction — 2026-11-02

READY for this scoped admin-only UI correction. Runtime commit: 3b2a12e.

Removed playback controls and hover/focus pauses. First transition occurs after 4 seconds, subsequent transitions after 8 seconds. Reduced motion preserves automatic text updates without 3D motion. Installed apps show honest installed status. Hidden tabs and open installation guides pause rotation.

Verified: 10 focused unit tests; one real-time Chromium journey covering hover, automatic full cycle, reduced motion and phone overflow; TypeScript; lint (zero errors, one existing AssistantWidget warning); production build; credential pattern scan. Browser journey used isolated port 5193 with Auth/Firestore emulators, not production accounts.

Hosting release wilo-admin-auto-header-20261102 published and independently matched to built index bytes through Windows read-only HTTP. Admin opt-in gate remains enabled; ordinary user design unchanged. No authentication domains, database rules, worker or account records changed. Physical device installation and live AI provider checks were not performed for this UI-only change. No whole-product readiness assertion.

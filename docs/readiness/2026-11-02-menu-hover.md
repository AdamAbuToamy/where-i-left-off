# Admin menu hover continuity — 2026-11-02

READY for scoped hover fix, runtime commit 2397275. A 10px visual gap between the trigger and dropdown caused pointerleave to close the menu. Added a 12px hit-test bridge only while the opted-in admin menu is open. Leaving the menu still closes it; navigation, keyboard and click handlers are unchanged.

Verified two Chromium journeys with disposable Auth/Firestore-emulator users: English/LTR and Arabic/RTL. Each physically moves the pointer into the gap, asserts the menu remains open, reaches an option, leaves and checks closure, then selects University and checks navigation/closure. Both passed. lint passed with one existing AssistantWidget warning; production build including TypeScript and credential pattern scan passed. No account data/schema/rules/auth-domain/worker changes. No live-provider or physical-device checks performed. Production verification is recorded in the adjacent proof JSON.

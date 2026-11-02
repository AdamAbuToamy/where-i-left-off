# Critical bootstrap loader — 2026-11-02

READY for this scoped bootstrap UI replacement. Runtime commit: 4639151.

The original index.html description was visible before React mounted. It is now a critical inline WILO loader with the existing cream/green palette, a bookmark illustration, short progress animation and a localized status. The saved language preference is read before the body renders; blocked storage falls back to English. Reduced-motion users get a static mark. A reload link becomes available after 15 seconds; no artificial delay is added to application startup. Without JavaScript the loader is replaced by a useful explanation and About link. The normal React mount removes the bootstrap markup. Public bootstrap only; account features and admin design gating are unchanged.

Verified: two Chromium journeys on isolated Auth/Firestore-emulator preview: delayed entry script, Arabic first display, phone width/no horizontal overflow, reduced motion, replacement by the real sign-in UI, and JavaScript-disabled fallback. Screenshots were visually inspected. The first no-script assertion used Playwright text matching that skips noscript descendants; a direct CSS locator and screenshot verified the visible fallback. Final run: 2 passed. lint: zero errors and one pre-existing AssistantWidget warning. Production npm run build (including TypeScript and credential pattern scan) passed. No live provider, physical device or store check performed; no production account writes.

Hosting publication and exact index-byte match are recorded in the adjacent production proof JSON. Authentication domains, Firestore rules, worker and persisted schemas were not changed.

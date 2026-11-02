# Header loading and timing correction — 2026-11-02

Scoped correction: subsequent rotations now wait 15 seconds (first remains 4 seconds). Header styling no longer depends on navigation mounting; authenticated opt-in styling is applied in a layout effect before paint. While authentication is unresolved the existing loading screen appears without rendering the old account header. Signed-out and ordinary users retain their normal settled design.

Runtime commit f59a0a7. Verified 10 focused unit tests, TypeScript, lint (zero errors, existing AssistantWidget warning), production build and credential pattern scan. Isolated Chromium/Auth/Firestore-emulator journey passed in 39.9 seconds: reload preserves transparent header background, automatic rotation while hovered, reduced-motion text updates, phone overflow. No production account writes or auth-domain changes. Not a full product readiness assertion; live providers and physical installs not retested.

# Admin cinematic motion preview — 2026-11-08

## Scope and rollout

User requested pronounced mobile/desktop choreography inspired by two supplied videos, cancellation/settings and first rollout for the verified owner administrator. Existing `isAdmin(email,emailVerified)` allowlist gates both the controller and settings; no client toggle grants data permissions. Ordinary accounts have no new scene controller, ambient layer or experimental preferences. No backend, rules, provider, scheduler or database change. No paid dependency or new package.

The official workspace is `/home/adam/projects/where-i-left-off`; recovery workspace remains untouched. Previous reviewed baseline is `57ce05579c1f284104578e32ef0e8f78bab572ea`.

## Behavior

- Native named page View Transitions where supported, interruptible on subsequent routes; opacity/reveal/sweep fallback otherwise. Snapshots cancel on logout/preview teardown/reduced motion.
- One-shot staggered viewport entry for cards, university tasks, settings, detail pages and assistant messages; a bounded delegated press ripple and sliding mobile navigation beacon; active navigation icons land in 3D. Week is explicitly its own active destination.
- Warm neutral entry typography remains horizontal/readable with concentric lens choreography and the existing synthesized entry cue. Calm mode shortens the entry and page transitions.
- Theme-derived, low-contrast ambient orbits; no cryptic glyphs, repeated logos, video download, microphone use or global redesign.
- Existing motion/sound opt-outs retained. Added cinematic/calm, background and interaction controls. Device/account-local settings, with OS Reduce Motion always overriding motion. All decorative layers are aria-hidden and pointer-transparent. Observer/audio/animation listeners are disposed on account changes; no animation waits before saving or navigation.
- Input/form/panel ancestors never gain transforms from the controller; no keyboard auto-focus added. Focus restoration, closing, native full-screen phone surfaces and app data behavior remain in existing components.

## Verification

- Full application suite:1331 tests passed across137 files (before the final navigation adapter); targeted navigation/preferences suite12 tests passed after the adapter change.
- Browser emulator:4 final cases passed: administrator desktop/phone, ordinary-account exclusion, and touch phone geometry with4x CPU slowdown. Includes authenticated synthetic sign-in, entry sound, responsive name, preference persistence/disable, reduced-motion live teardown, rapid route interruption, mobile Week selection, opening assistant/new card, stable typing position, no horizontal overflow and cancellation without saving.
- Initial fixture corrections: gave Motion style an explicit accessible name; supplied a synthetic assistant connection and actual coarse/touch device context. No disabled control or security check bypassed.
- TypeScript, ESLint, architecture and credential checks passed. Production build and Hosting read-only verification are separate release steps. No real account/reminder/assignment writes.
- Prior baseline GitHub full browser run42499789192 failed on existing navigation/hover/assistant assertions; this report does not claim that suite passed or repair unrelated journeys. Focused checks above are a separate, local emulator result.

## Limits and recovery

Chromium/mobile emulation is not a physical Android/iOS keyboard, audio or Safari test. Actual owner sign-in and perception of animation intensity remain an owner device review. Unsupported View Transitions use the fallback. Existing Vite large-chunk warning remains. Delivery evidence is stored in the release marker/operator verification, not inferred from local tests. Roll back only Hosting if needed; no data migration is involved. Admin can disable everything immediately under Settings → Appearance → Motion & sound.

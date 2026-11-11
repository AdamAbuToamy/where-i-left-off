# Dark appearance refinement — 2026-11-11

Replaced the muddy green base with neutral charcoal/slate, brighter card surfaces, clearer input separation and a stronger green primary action. Text stays off-white; muted text, borders, dotted/paper/grid/mist textures are quieter. Existing palette accents and light mode are preserved. Updated browser theme-color and bootstrap metadata to match the new background.

Verified locally: 7 Chromium browser cases passed: phone/desktop light and dark populated cards, notes/links and editor persistence, contrast checks in card details/editors and main card surface, mode settings/persistence, system changes and early bootstrap. Phone screenshot inspected. Physical devices not tested. No data/auth/backend/reminder changes. Broader legacy browser-test limitations from QUALITY-2026-11-11.md remain unchanged.

Focused color-mode tests, lint, architecture and production build are release gates. Production anonymous dark/bootstrap checks and asset parity are recorded outside Git in /home/adam/wilo-recovery/20261111-dark-comfort. No production account writes or live Push tests.

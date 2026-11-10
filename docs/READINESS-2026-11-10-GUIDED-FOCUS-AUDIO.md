# Guided focus, optional card details and audio — 2026-11-10

## Behavior
The guide now portals inside desktop expanded cards as well as phone forms/cards and native dialogs. It remains above the active surface and outside inert siblings. Scoped guide button styles prevent card-wide rules from crushing its heading into a narrow column. Surface transforms are suspended only while hosting a guide so fixed highlight coordinates stay aligned.

A dimmed focus cutout and reversible sibling blur emphasize the actual target while keeping the companion clear. Blur styles are restored when the target changes, the guide is minimized, or the tour ends. No permanent animation loop is used for geometry.

Creating a card requires only its existing title field. Once a title is present the user can save directly with the guide's explicit action, or choose optional details. Both paths use the real form and its validators/submission lock. The desktop browser journey covers a name-only card; the phone journey covers optional next-step entry.

The same four activities have slightly fuller localized explanations in Arabic, English and Hebrew. No new areas or automatic transitions were added.

Short synthesized two-note guidance uses the existing InteractionAudio boundary. Audio unlocks only after interaction, is skipped while the document is hidden, honors the existing per-account Wilo sound preference and immediate mute changes, and disposes at tour exit. No voice service, media download, microphone use, backend or new dependency.

## Evidence
- Full application suite: 150 files / 1375 passed.
- Focused audio/accessibility suites: 11 passed, including gesture gating, one cue per change, live mute and disposal.
- Emulator browser journeys: desktop English and phone Arabic passed. Verified companion visibility/accessibility within expanded cards, readable heading/control sizes, focus blur, name-only and optional-detail saves, account creation receipts, keep/delete isolation and reload.
- Expanded-card desktop/phone screenshots visually reviewed.
- Final lint, architecture, TypeScript/build and credential checks are release gates.
- Physical handset audio playback was not checked. Browser/device autoplay or mute policy may suppress sound; it never blocks an action.

No production account data changes, Push tests, auth changes, scheduling changes or database migration are part of this release. Recovery/proof: /home/adam/wilo-recovery/20261110-guided-focus-audio/.

# Session download, layout and save recovery — 2026-10-29

## Changes

The session dialog now renders in a body portal, outside project-card button styles. Explicit grids keep the input wide, Add compact and Arabic checklist text readable. Manual-edit labels have unique IDs.

A successful Firestore transaction is the save acknowledgement. An unnecessary post-commit server read previously could report failure after a successful write; it was removed. SDK failures are mapped at the adapter boundary to safe codes, while local queued edits, revision checks and account isolation remain. Production Firestore rules were inspected read-only and match the repository. No production account write was used to reproduce the screenshot's account-specific failure; permission/network errors remain possible and now expose a safe diagnostic code.

Model installation is independent of microphone/session lifetime. The pinned Whisper Large V3 Turbo q4f16 weights remain unchanged. Thirty-five ranges of at most 16 MiB are SHA-256 checked, retained across interruptions and assembled into the existing OPFS cache. Already installed canonical weights are reused. The browser installer uses four concurrent foreground requests or Background Fetch when supported, with quota checks and explicit fallback copy. Neither audio nor account data enters the installer. No API key or cloud transcription was added.

Whole-file Background Fetch failed at full weight size despite a passing small fixture. That implementation was replaced with verified ranged parts. The final full-size test transferred **563,479,095 bytes** and committed both weights after **all site pages were closed**, using native Windows Chrome and a local HTTP mirror of the real pinned model. This proves the browser/storage lifecycle, not internet speed. [Machine-readable evidence](2026-10-29-session-background-download.json).

## Verification performed

- Unit/application: GitHub PR quality checks passed all 1,205 tests on the final implementation. The separate focused adapter/repository/service-worker regression run passed all 12 tests, including the added failure-mapping case.
- Firestore rules/persistence: 680 passed; authentication recovery: 3 passed.
- Browser journeys: 49 passed, one opt-in real-audio test skipped in the ordinary suite. Includes mobile Arabic geometry and real Background Fetch/OPFS with synthetic bytes.
- Separate native Windows/NVIDIA real-model audio journey: 1 passed, including download while the session dialog was closed, actual inference, emulator persistence, reload and cached restart with model-host requests blocked. Legal WAV input through a simulated microphone; no production account writes.
- Backend: 874 passed; architecture and credential checks passed.
- ESLint: zero errors; one existing AssistantWidget ref-cleanup warning. TypeScript passed. Production dependency audit: zero vulnerabilities.
- Reproduce background transport: `node scripts/test-session-background-download.mjs`; add `--real-model` when pinned local mirror weights exist. Set `TEST_CHROMIUM_PATH` to a full Chrome executable if needed.

## Limits and rollback

Background completion requires supporting Chrome/Edge; the fallback needs the site tab open. Browser exit, device shutdown, storage eviction, insufficient disk and weak WebGPU remain limits. Download volume is still about 565 MB and connection speed determines network duration. No guarantee of perfect Palestinian/Shami Arabic, Hebrew, English or mixed speech; previous measured accuracy limitations remain. Physical microphones and phones were not newly verified.

No schema migration, Firestore rule change or backend deployment is required. Roll back the frontend to main commit `fa0427c` if necessary. Existing model files and session records remain compatible. Production build passed. Publication and read-only verification are recorded below.


## Published release

- [PR #45](https://github.com/AdamAbuToamy/where-i-left-off/pull/45) merged as `2ff3b13c9a0152fb26234d2306c3a81d276d74ed` after all five [PR quality jobs](https://github.com/AdamAbuToamy/where-i-left-off/actions/runs/40914393106) passed.
- The merged source fingerprint matched the locally built production assets. Firebase CLI deployed Hosting only to `where-i-left-off-b5683` on 2026-10-29; no Worker or Firestore rules were changed.
- Production HTTP verification passed for the source fingerprint, session panel, download worker, background-fetch service-worker manifest and exact installer helper SHA-256. [Read-only verification evidence](2026-10-29-session-download-production.json).
- The automatic main-branch quality rerun was still in progress when this publication evidence was recorded. It is distinct from the already successful PR checks and local verification; it is not reported as passed here.

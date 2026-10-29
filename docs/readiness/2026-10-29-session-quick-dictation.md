# Session dictation responsiveness and explicit approval — 2026-10-29

## Scope

Only the work-session experience changed. Same pinned Whisper Turbo model and saved assets; no extra download, cloud audio or persistence schema/rule change.

- Shorten silence segmentation from 800 ms to 450 ms and maximum capture from 12 s to 6 s. Disable the optional queued-utterance batching in the panel. This reduces capture delay, not the model's GPU inference time; no universal latency/accuracy claim is made.
- Keep the loaded model during explicit pauses inside the open session. The microphone stops immediately; pending captured speech finishes. Closing, hiding, changing language, cancellation and errors release resources. The default controller finish still releases the model for other callers.
- A new explicit recording always starts a separate transcript paragraph, even immediately after the preceding recording. Within one recording, short chunks can still join a readable paragraph.
- After stopping, each editable paragraph offers Note or Next step and Approve and save. Corrections retain compare-and-set validation. Notes use the existing domain planner/repository. The card next step uses its existing revision-checked save callback, updates the session's field and increments its expected revision only after success. Speech does not choose or execute these actions automatically.
- Scoped recording bars, download icon movement and a compact download card retain existing colors and respect reduced motion.

## Verification

Final GitHub PR quality checks passed all 1,208 application tests. The final focused controller/segmentation/transcript suite passed 25 tests including warm reuse/release, short silence and explicit paragraph boundaries. The emulator-backed browser session suite passed 3 journeys including approval to both note and next step, corrected text, a second recording on a separate line, reload, manual controls and mobile RTL. These UI journeys inject inference and do not prove ASR accuracy.

TypeScript, architecture and credential checks passed. ESLint has zero errors and the existing unrelated AssistantWidget warning. No domain schema, Firestore rules or backend files changed. All five PR quality jobs passed, including authentication recovery, rules, browser, dependency audit and unit/worker checks.

A separate native Windows Chrome/NVIDIA real-model journey passed (34.9 s total test duration, not inference latency): actual pinned weights, microphone WAV input, literal transcription, pause with tracks stopped/model retained, emulator persistence, reload with remote model requests blocked, and worker release on session close. Two initial native runs stopped at model installation before inference and are not counted as successful audio evidence; the final rerun with the local range-capable model mirror passed. No physical microphone or phone was newly tested.

## Limits and rollback

The model still requires compatible WebGPU hardware and may be slow on weak devices. Six-second capture boundaries can split long phrases; editing remains available. A single card next step is replaced only on explicit approval. No perfect dialect or mixed-language accuracy is promised. Roll back frontend code to `d669aaa` without migrating session records or weights.


## Publication

[PR #46](https://github.com/AdamAbuToamy/where-i-left-off/pull/46) merged as `ba48fe1589cf351e7e76bf7c10cdeef638818718` after successful [PR quality checks](https://github.com/AdamAbuToamy/where-i-left-off/actions/runs/40929866179). A fresh production build was deployed to Firebase Hosting only. Production read-only HTTP verification matched the release fingerprint and the published panel, installer worker and unchanged installer helper. [Verification evidence](2026-10-29-session-quick-dictation-production.json). Automatic main quality/deployment reruns are distinct and were not awaited or represented as completed for this evidence.

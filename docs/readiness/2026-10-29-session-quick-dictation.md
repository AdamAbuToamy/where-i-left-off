# Session dictation responsiveness and explicit approval — 2026-10-29

## Scope

Only the work-session experience changed. Same pinned Whisper Turbo model and saved assets; no extra download, cloud audio or persistence schema/rule change.

- Shorten silence segmentation from 800 ms to 450 ms and maximum capture from 12 s to 6 s. Disable the optional queued-utterance batching in the panel. This reduces capture delay, not the model's GPU inference time; no universal latency/accuracy claim is made.
- Keep the loaded model during explicit pauses inside the open session. The microphone stops immediately; pending captured speech finishes. Closing, hiding, changing language, cancellation and errors release resources. The default controller finish still releases the model for other callers.
- A new explicit recording always starts a separate transcript paragraph, even immediately after the preceding recording. Within one recording, short chunks can still join a readable paragraph.
- After stopping, each editable paragraph offers Note or Next step and Approve and save. Corrections retain compare-and-set validation. Notes use the existing domain planner/repository. The card next step uses its existing revision-checked save callback, updates the session's field and increments its expected revision only after success. Speech does not choose or execute these actions automatically.
- Scoped recording bars, download icon movement and a compact download card retain existing colors and respect reduced motion.

## Verification

Full application suite passed 1,207 tests before the final warm-model refinement. The final focused controller/segmentation/transcript suite passed 25 tests including warm reuse/release, short silence and explicit paragraph boundaries. The emulator-backed browser session suite passed 3 journeys including approval to both note and next step, corrected text, a second recording on a separate line, reload, manual controls and mobile RTL. These UI journeys inject inference and do not prove ASR accuracy.

TypeScript, architecture and credential checks passed. ESLint has zero errors and the existing unrelated AssistantWidget warning. No domain schema, Firestore rules or backend files changed; previous rule/backend checks are not represented as newly run. Separate real-model native audio and deployment evidence are recorded after completion.

## Limits and rollback

The model still requires compatible WebGPU hardware and may be slow on weak devices. Six-second capture boundaries can split long phrases; editing remains available. A single card next step is replaced only on explicit approval. No perfect dialect or mixed-language accuracy is promised. Roll back frontend code to `d669aaa` without migrating session records or weights.

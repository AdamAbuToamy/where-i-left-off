# Short voice messages — 2026-10-29

## Behavior

The session now records a complete short voice message before transcription. A circular microphone starts capture immediately without loading/running the model. A visible counter shows the explicit 24-second limit; stop or the limit ends capture. No silence threshold splits the clip or omits quiet frames. The AudioWorklet acknowledges flushing its final sub-frame before microphone teardown. The local model then processes one complete clip; there is no inference backlog while speaking.

A visible discard control can cancel processing and release the worker; a failed inference retains the original bounded PCM buffer for retry; a copy is transferred to the worker. Successful inference wipes audio and produces an editable in-memory draft. Explicit approval saves a separate transcript and selected note in one domain-validated session proposal. Choosing next step uses the existing revision-checked card save callback, then records the transcript; these distinct stores are not represented as an atomic cross-store transaction. A failed save keeps the draft for retry. Discard does not create account content. Closing is blocked until pending audio/text is reviewed or explicitly discarded. Hard reload/process termination can lose unapproved drafts.

Same model, pinned weights/cache and local-only audio. Loaded model resources are reused between messages and released on close. Existing manual notes/checklist, old transcripts, account isolation and revision checks are preserved. Browser/Firebase adapters remain outside the application controller; architecture checks now include the new clip controller and pure audio buffer.

## Verification

Final GitHub PR unit/application suite: 1,214 passed. Final focused clip/cancellation/worklet-tail suite: 6 passed. Emulator-backed session browser journeys: 3 passed, covering no text/account addition before stop/approval, corrected note approval, next-step approval, separate message rows, reload and mobile RTL/manual controls. UI journeys inject inference; they do not establish speech accuracy. TypeScript, lint (existing unrelated AssistantWidget warning only) and architecture checks passed. A separate native Windows Chrome/NVIDIA journey with the actual model and synthetic microphone WAV passed (54.8 s for the complete test, not an inference-latency figure). It captured ten seconds before processing, presented a review without saving text, saved after explicit approval, reloaded and reused cached weights with remote model requests blocked, discarded a second message and verified worker cleanup on close. This is not a physical-microphone or new dialect benchmark. Publication evidence is recorded after deployment.

## Limits

Capture includes every input sample up to the explicit 24-second cap, but model recognition is not guaranteed word-perfect. Processing time still depends on local GPU. No physical-phone/microphone or new dialect benchmark is claimed. Initial model startup occurs after stopping the first clip; subsequent clips reuse it. No rules/schema/backend change or model redownload is required. Rollback frontend to `5f10a7c` without migrating account data or model assets.


## Published release

[PR #47](https://github.com/AdamAbuToamy/where-i-left-off/pull/47) merged as `827153b049cd2a39d7a202978aa4c5bfc30ccd2f` after all five [PR quality jobs](https://github.com/AdamAbuToamy/where-i-left-off/actions/runs/40941161524) passed, including full browser, rules, authentication recovery and unit/worker checks. The production build matched the merged source fingerprint and was deployed to Firebase Hosting only.

Production read-only HTTP verification passed for the release fingerprint and exact session-panel bytes, including voice-message/review controls. [Verification evidence](2026-10-29-session-voice-messages-production.json). No production account data was written by verification. Automatic main quality/hosting reruns are distinct and were not awaited or represented as passed for this publication evidence.

# Private session voice workspaces — 2026-10-28

## Context

Completed `sessions` documents are immutable statistics. A live checklist and editable accepted notes need revision checks, offline edits, account isolation and safe undo. The existing card checklist cannot represent a session-specific order or private notes on group cards. The cloud text assistant is the deployed default; optional WebLLM is not an audio recognizer.

## Decision

Keep existing timer, checkpoint writes and completed-session schema. Add an owner-private `sessionWorkspaces` document keyed by the timer's stable session ID, with a versioned domain payload and CAS envelope. An application repository owns domain validation, a transactional IndexedDB outbox and explicit conflict resolution. Firestore and browser adapters are wired at the composition boundary. A metadata revision is separate from content revision, so transcript retention does not invalidate a reviewed checklist operation or safe content undo. Stable operation IDs are retained until the explicit bounded session limit; no silent pruning permits a retry to execute again.

Extend the current assistant control catalog with typed session operations. Both voice review and optional consented text-assistant operations use the same planner/repository. Reject proposals mixing session changes with other mutation boundaries. Group all session controls into one review/apply transaction and show every proposed operation. Do not stream writes or weaken existing card/study validators.

Use local multilingual Whisper through pinned Transformers.js 4.3.2 and ONNX Runtime WASM in a dedicated Worker, with a separate microphone AudioWorklet and bounded utterance queue. Pin both normal construction and registry discovery asset URLs; v4 discovery otherwise consults `main` even when a model revision is specified. Load on explicit action only, cache assets, and lease large local inference resources across speech/WebLLM. Stop/release on cancellation, hidden page, unmount and account change. No SpeechRecognition or hidden cloud fallback.

Interpret supported direct session commands with a conservative local multilingual grammar. Uncertainty, negation and quotes become editable speech, never destructive intent. Automatic notes are extractive drafts, not an invented semantic summary; acceptance is explicit. Final segments only, stable capture IDs, captured order/content revision, bounded backlog, complete proposal validation and entity-scoped revision-checked undo protect integrity. Numeric voice confirmation binds to the exact pending proposal and content revision.

Audio is ephemeral. Accepted notes persist normally; complete transcript/source retention and cloud sharing are separate explicit opt-ins. Sharing includes only the checklist and bounded accepted-note excerpts, never audio/full transcripts. Runtime diagnostics contain codes/timings, not account text or credentials. Personal export includes server-saved workspaces, and account deletion uses the existing recursive-delete mechanism plus local cache cleanup.

## Alternatives and consequences

Browser SpeechRecognition is not a local-processing guarantee. Cloud STT needs separate consent/credentials and is unnecessary for the requested default. Concurrent WebLLM and ASR increases memory pressure; a local command grammar avoids loading a second model and keeps speech private. A generic event bus/CQRS rewrite would add unrelated complexity; a single private per-session CAS document fits the bounded workload.

A serialized payload means Firestore rules enforce the authorization/envelope boundary while the domain validates the inner schema. It is not authorization to modify another account or card. An owner can corrupt their own payload using a custom client; readers reject invalid payloads. Explicit caps stay well under Firestore document limits and prevent unbounded audio/text retention.

Model quality and local latency depend on language, noise and hardware; legal human/synthetic audio results are recorded separately from injected-inference browser tests. Manual correction remains first-class. Physical microphones, mobile memory/thermal limits and Palestinian dialect quality are explicit release limitations. Browser cache persistence is best-effort and cannot survive deliberate data deletion or guaranteed eviction prevention.

No production rules, Worker or hosting deployment is part of this change. A future rollout publishes rules before the client/catalog. Rollback can restore the previous UI while retaining the additive private collection; no destructive migration is required.

## Primary references

- [Transformers.js browser inference and supported audio tasks](https://huggingface.co/docs/transformers.js/en/index).
- [Transformers.js 4.3.2 release](https://github.com/huggingface/transformers.js/releases/tag/4.3.2).
- [Whisper Base ONNX model assets](https://huggingface.co/onnx-community/whisper-base).
- [FLEURS dataset and attribution/license](https://huggingface.co/datasets/google/fleurs).


## 2026-10-29: dictation-only session experience

The user rejected automatic notes, voice commands and the review-heavy interface. The session UI now exposes editable literal transcription, manually written notes and a manual checklist. It does not attach the cloud assistant bridge or interpret spoken commands. Prior saved notes/items and command-domain contracts remain compatible, but those voice controls are no longer offered in this UI.

Whisper Base is replaced by pinned Whisper Large V3 Turbo q4f16 (~565 MB) on WebGPU with shader-f16. Real public-audio evaluation showed an improvement, with remaining Palestinian/Hebrew/mixed-language errors; this is not a promise of perfect dictation. FP16 encoder cost was not justified by the tested quality. Unsupported GPUs keep the manual tabs rather than silently switching to a weak model or uploading audio.

Original-text comparison protects transcript corrections. Transcript-only operations can coexist with unrelated checklist edits; remote account revisions and atomic state validation remain enforced. Explicit recording pauses flush final speech before disposal; hidden-page cancellation remains immediate. See the 2026-10-29 readiness report for evidence and limitations.

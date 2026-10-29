# Session dictation correction — 2026-10-29

## Scope

Replaces the session voice command/review interface with three tabs: editable verbatim dictation, manual notes, manual checklist. Existing saved notes/items and checkpoint/session history remain compatible. Voice never calls the command parser or creates notes/items. The general assistant does not offer private session tools without explicitly shared context.

Transcript corrections use original-text compare-and-set, plus existing account isolation, local outbox and remote CAS. Transcript-only writes tolerate unrelated checklist changes while checking the targeted paragraph. Explicit Pause/close/end flush buffered words; hidden-page/unmount cancellation still immediately releases recording. Bounded waiting audio can be grouped into 28-second batches without reordering samples. No raw audio upload.

## Model evidence

Pinned Whisper Large V3 Turbo q4f16, ~565 MB, WebGPU shader-f16 required. Real Windows Chrome WebGPU inference was run on public Arabic/Hebrew/English FLEURS samples, three unchanged Palestinian Casablanca excerpts and synthetic Windows speech. Locally mirrored assets retain the pinned upstream bytes; both weight SHA256 values were verified. No model outputs were injected in those measurements. See [aggregate measurements](2026-10-29-session-dictation-audio.json).

NVIDIA RTX 3050 Laptop measured approximately 2.2–3.4 seconds for the tested 9–11-second Palestinian excerpts after loading. Intel was slower (~14–19 seconds). Forcing NVIDIA was a test-process flag; production can request high-performance but cannot force OS adapter selection. FP16 encoder (~1.47 GB total) was compared and did not give enough improvement to justify its cost; q4f16 retained. This is a small sample, not a dialect benchmark: Palestinian and Hebrew errors remain, synthetic mixed speech performed poorly, and natural Syrian speech/physical microphones/mobile GPUs were not verified. No claim of near-perfect recognition.

FLEURS: Google, CC-BY-4.0. Casablanca: UBC-NLP/Talafha et al., CC-BY-NC-ND-4.0, unchanged audio used for internal evaluation; audio is not shipped or redistributed. Model weights are fetched only after explicit Start and reused from browser cache; browser eviction remains possible.

## Verification

- Unit/application: 1201 passed (101 files).
- Backend: 874 passed.
- Targeted emulator browser journeys: 7 passed, including literal dictation with an injected inference worker, direct correction/reload, notes/checklist/offline persistence, RTL mobile, accessibility and prior card workflows. These do not establish recognition accuracy.
- TypeScript and architecture: passed; lint: no errors, one pre-existing AssistantWidget cleanup-ref warning.
- Full emulator browser suite: 48 passed, 1 opt-in real-audio test skipped on WSL.
- Native Windows Chrome/NVIDIA real microphone-pipeline test with legal synthetic WAV: passed separately. Verified actual transcription, Firestore/reload, zero automatic notes/items, microphone/worker release, then a second model load with every Hugging Face request blocked. No weight redownload.
- Rules/persistence: 680 passed; authentication recovery: 3 passed.
- Production build and credential pattern checks: passed; existing App Check public configuration preserved. The bundle size warning is unchanged in kind. Deployed release verification follows below.

## Limits and recovery

Requires a compatible GPU; unsupported devices retain manual notes/checklist with a clear error before model download. Model load time and recognition speed depend on device/network. Transcript text is saved to the account after explicit Start; audio remains local. Clearing transcript preserves notes/items. Existing 100-paragraph/1000-operation/180k-character limits remain; paragraphs group consecutive chunks. Browser cache persistence is best effort. No cloud fallback. Forced browser close may lose audio not yet transcribed.

No rule/schema migration. Rollback frontend to e3f29a6 (previous main) and restore prior Worker version 9a6c9200-87c4-452f-8cb0-7b71f543e489 if needed; saved state schema is compatible. Deployment not yet verified in this report.


## Cache regression found and fixed

The original CacheStorage writer returned an internal browser error for the 370 MB encoder despite enough free quota; inference still worked but the file was absent on reopening. Large public weights now use origin-private filesystem storage, publishing size metadata only after the complete file commits. Smaller metadata/tokenizer files retain CacheStorage compatibility. The worker verifies both weights are retained before reporting successful installation, and reports a storage error if they are not. The native test stored ~563 MB in OPFS and successfully reinitialized with upstream model requests blocked. Storage eviction/deletion remains a browser/user action outside the application's guarantee.

Existing persistence debt: a remote Firestore transaction is serialized with local repository work; dropping connectivity during an already-running transaction can temporarily delay subsequent edits. Offline edits begun after completed synchronization were tested. This pre-existing boundary was not rewritten in this UI correction.

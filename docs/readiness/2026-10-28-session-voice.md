# Session voice assistant readiness — 2026-10-28

Status: implemented and verified locally; **not deployed to production**. The review/manual/session-persistence path works. Local AR/HE recognition, especially mixed technical speech, has significant measured accuracy limits. This is not a claim of reliable hands-free understanding on every device.

## Delivered path and boundaries

Open card work session → explicit microphone action → cached local ASR Worker → partial display/final editable transcript → conservative local session command → complete validated operation preview → Apply (or explicit matching proposal number) → transactional local save/outbox → revision-checked Firestore save → reload/history. The checklist and accepted session notes are also fully usable manually. Auto notes are verbatim editable suggestions; accept/edit/reject never auto-executes account mutations.

Separate accepted content, opt-in full transcript retention, and opt-in sharing of accepted-note excerpts/checklist with the existing text assistant. Audio is never recorded or uploaded by this feature. Existing card checkpoint/timer and immutable session-history schemas remain unchanged. New content is owner-private even for a group card. Personal export includes server-saved content; account deletion clears the new local DB and uses existing recursive server deletion.

Core invariants/commands/control proposals: `src/session/domain.ts`, `commands.ts`, `control.ts`. Application ports/CAS/conflicts/undo/outbox: `repository.ts`, browser/Firestore adapters and composition. Audio capture, segmentation, inference and cancellation are separate modules. `SessionVoicePanel` composes them, with manual editor/proposal presenters. New session controls extend the existing assistant engine/catalog and cannot mix with other mutation boundaries in one proposal. Every session operation is shown in review, not just the first item.

## Automated evidence

| Check | Actual result |
| --- | --- |
| `npm test` | 1190 passed across 100 files; includes session domain, local multilingual commands, repository/offline/conflicts, lifecycle and assistant control regressions |
| `npm run test:rules` / Java 21 | 680 passed across 15 files, including real Firestore adapter round-trip/CAS, owner isolation, forged group/card, suspended/deletion accounts and legacy sessions |
| `npm run test:auth:recovery` | 3 passed against Auth emulator |
| `node --test push-worker/*.test.mjs` | 874 passed |
| Full browser suite with opt-in real WAV journey | 49 passed against isolated Auth/Firestore emulators |
| Final targeted session browser journeys | 4 passed: offline/reload/undo/history + injected inference + phone RTL/axe + real local ASR/persistence; the final production build and 37 focused regressions also passed after the last presentation/history changes |
| Real microphone resource boundary | Chromium virtual device/AudioWorklet; track `readyState=ended` and actual Worker termination asserted after pause |
| Architecture check | Passed; 9 protected roots, 19 transitive modules, zero violations |
| Typecheck / production build | Passed; normal existing large-chunk warning remains |
| ESLint | Zero errors; one pre-existing `AssistantWidget` cleanup-ref warning remains |
| Credential pattern checks / `git diff --check` | Passed; pattern scanning is not a complete secret audit |
| Production dependency audit | `npm audit --omit=dev` reported zero advisories in the installed lockfile |

Browser tests distinguish injected inference from actual model inference. The real-audio journey feeds a synthetic legal WAV through Chromium's virtual microphone and the actual shipped worker, then the real command planner and emulator Firestore, and verifies reload. It does not call a cloud AI provider or a physical microphone. Ordinary browser tests do not download models in CI; the real-audio test is opt-in and skipped unless the file is explicitly supplied.

## Model selection, audio evidence and honest limitations

Default: **onnx-community/whisper-base**, multilingual, q8, WASM CPU, Transformers.js **4.3.2**. Model revision `1846881b6b3a3024392c1eea3ad983695bc23925`. Approximately 80 MB public model assets plus a 27 MB runtime, downloaded only on explicit first use. Model, registry-discovery and runtime assets are version-pinned. Worker/runtime are excluded from PWA install prefetch and cached when used. A fresh Worker loaded the model successfully with the browser offline after its first cached use.

Seven small cases, each clean and with deterministic added white noise at 20 dB SNR: three human FLEURS excerpts (Arabic/Hebrew/English), three OS-generated command fixtures, and one synthetic Arabic/English technical-name splice. Google FLEURS is CC-BY-4.0; attribution: Google, https://huggingface.co/datasets/google/fleurs. Windows voice fixtures are generated locally using installed licensed voices; no audio/weight binaries are committed. This tiny sample set is a smoke check, not a representative language benchmark. WER can exceed 100% when output inserts words. Normalization: NFKC, lowercase, remove marks/punctuation/symbols, collapse whitespace; no special Arabic spelling substitutions.

| Case | Clean WER | Clean CER | Added-noise CER | Clean inference ms |
| --- | --- | --- | --- | --- |
| ar_eg | 66.7% | 12.2% | 13.3% | 4539 |
| he_il | 72.7% | 20.7% | 51.7% | 3965 |
| en_us | 5.3% | 1.0% | 1.0% | 3704 |
| command-ar | 20.0% | 8.3% | 25.0% | 3513 |
| command-he | 25.0% | 4.0% | 64.0% | 3438 |
| command-en | 0% | 0% | 0% | 3230 |
| command-mixed | 100% | 60.6% | 69.7% | 3701 |

[Full Base results](2026-10-28-session-speech-base-audio.json) include references and recognized text. The English Firebase command was recognized exactly after normalization. Arabic wording had errors; the clean synthetic Hebrew command misrecognized the leading verb, so it would need correction rather than silently mutating the list. The mixed-language synthetic command failed badly. **Do not advertise reliable Palestinian/code-switch/technical recognition or promote raw transcript output to an automatic action.** Manual correction and explicit proposal review are essential with this model.

Measured clean inference was approximately 3.2–4.5 seconds per short fixture on this desktop environment. This does not predict phone latency. The first public CDN download was slow and exceeded test timeouts; complete pinned bytes were downloaded and the quality runs used a local transport mirror of those same public assets. The mirror does not replace inference responses. It is removed before the offline-cache test. Public-CDN cold-download speed is therefore not a passed production guarantee. Initial load has a finite ten-minute allowance and explicit cancellation; manual entry stays available.

Whisper Small was also downloaded and its weight SHA-256 values were checked against Hub metadata. The first real-worker run ended with the browser/page closing before a usable result. [Recorded Small attempt](2026-10-28-session-speech-small-attempt.json). Its cause was not established, and there is no valid accuracy comparison. Small was not selected or exposed as a supposedly proven fallback.

No physical microphone, Android/iOS device, natural Palestinian sample, naturally noisy room or natural human code-switch sample was verified. The synthetic splice and injected text tests cannot establish those capabilities. No live cloud text-provider call was used to validate the optional session control schema; native tools/application contracts were tested with injected providers. Existing real Google/Pollinations consent, store/PWA/device checks remain separate.

## Deployment, compatibility and recovery

No production hosting, Firestore rules, Worker deployment, data deletion or main-branch merge was performed. The additive rules for `users/{uid}/sessionWorkspaces/{sessionId}` must be deployed before any future client/Worker rollout; no new index, cloud credential or legacy-session migration is required. A group-linked session requires a real group card and current membership at creation, but its accepted notes remain owner-private. Old clients ignore the collection. Rollback restores the previous client while preserving new private content; do not delete it as part of rollback.

The domain validates the entire serialized payload. Firestore rules enforce owner/account state, source identity, metadata shape, size and CAS revision. Rules do not parse JSON, so an owner using a custom client can corrupt their own payload; readers reject it. Cross-account access remains prohibited.

Local pending work is protected by account/session keys, IndexedDB atomic writes, CAS and explicit conflict resolution. Background synchronization skips conflicted sessions, preserving them for user resolution. Browser cache persistence is best-effort; eviction or clearing browser data may require another download. Caps are explicit (100 items, 100 notes, 100 retained transcript segments, 1000 operation IDs, 180k payload characters); capacity errors never silently drop accepted content. Unaccepted drafts are transient and bounded at ten. The existing history reads the most recent 500 account sessions, with five-at-a-time display per card; older server data is included in personal export.

See [Arabic setup/privacy/test guide](../SESSION_VOICE_AR.md). Fresh root installs use `ONNXRUNTIME_NODE_INSTALL=skip npm ci` to avoid unrelated native CUDA downloads; CI install steps carry that supported environment variable. The browser uses the lockfile's ONNX Runtime Web assets, not CUDA.

## Before a production approval

- Validate recognition and correction with actual Palestinian/Arabic, Hebrew and mixed technical speech on intended hardware. The measured Base limitations are a product acceptance decision, not hidden by a green test count.
- Check microphone permission/device loss/background/cleanup on real Android and iOS; verify storage quota/eviction and practical cold-download speed.
- Review and authorize the additive Firestore rules and eventual Worker/client deployment in that order.
- Keep local manual input and explicit reviewed application as the dependable fallback. Do not advertise cloud-free voice as universally real-time or flawless.

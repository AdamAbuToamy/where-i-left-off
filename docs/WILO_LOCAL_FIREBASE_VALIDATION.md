# Wilo local assistant and Firebase verification — 2026-10-25

## Changes

- Refreshed the local activation screen, orbital animation, progress track and setup steps in Arabic, English and Hebrew, including reduced-motion support.
- Local remains the default. A successful model download is followed by a real smoke completion before the UI reports readiness. Cancellation also rejects readiness inference. Local connection diagnostics do not invoke the cloud provider.
- Local planning receives a compact tool contract derived from the actual executor schemas, including read arguments, allowed mutation fields and task references. The model proposes; the existing validators, review, domain functions and Firestore save receipts control execution.
- Pinned the published Qwen3-4B metadata, including sliding-window settings and the conversation template, alongside the existing model/runtime. Source: https://huggingface.co/mlc-ai/Qwen3-4B-q4f16_1-MLC/raw/main/mlc-chat-config.json . The tool-result role is represented as user data because this client translates read results into explicitly untrusted user messages.
- Added strict handling for Qwen's reasoning envelope and JSON fences. Arbitrary prose, unsupported tools, incomplete reasoning and multiple calls remain rejected.
- Fixed the Ollama acceptance runner's syntax error. Its results are separate from evidence for the browser-shipped model.

## Firebase findings and fixes

The latest production `project.create` errors inspected were `invalid-project-url` (2026-10-25 09:42–09:46 UTC). These originated in local validation, while the old UI incorrectly displayed a generic Firebase/connection message. Older `permission-denied` events also existed; their original cause has not been conclusively established.

- URL, attachment and date validation failures now explain the field to correct instead of blaming Firebase.
- HTTP URL validation matches the scheme syntax accepted by the Firestore rules.
- An edited card URL takes precedence over stale catalog metadata in both creation and editing.
- Firestore terminates a subscription when its error callback fires. Retry and reconnection now re-establish failed subscriptions; pending mutations retain their IDs, and callbacks from obsolete subscriptions or accounts are ignored.
- The production read-only API/domain/App Check configuration audit passed. This does not prove attestation or OAuth success in every user's browser. No production rules, enforcement, account permissions or records were changed.

## Verification

- Unit suite before the final parser regression cases: 1,046 passed. The 12 targeted local-model/parser cases subsequently passed.
- Production build and ESLint passed; the existing bundle-size advisory remains.
- Four real browser tests against Firebase emulators passed: phone creation/edit/persistence, browser capture, offline creation/reconnect, and extension auto-capture without duplicates after reload.
- The first security/persistence run passed 673/675; two injected-provider UI fixtures still assumed a cloud default. Their setup was corrected to select the injected provider explicitly, without changing the product's local default. See the final run below.
- Real Windows Chrome / Intel gen-12lp WebGPU with shader-f16 loaded Qwen3-4B and produced a greeting in 8,318 ms. This confirms initialization and one generation, not correct execution of the 618 requests.

## Release limitation

The 618 real-model acceptance cases have NOT been certified. Unit/corpus fixture passes are not model comprehension passes. The first live mutation request was still running during implementation; the subsequent reasoning-envelope fix changes the source fingerprint, so earlier evidence cannot certify the final source. Use the repository's `scripts/test-assistant-browser.mjs` acceptance/persistence gate before a local-assistant release. No deployment was performed as part of this change.
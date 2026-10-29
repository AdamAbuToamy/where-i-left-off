# Session dictation deployment — 2026-10-29

- Site: https://where-i-left-off.web.app
- Merged PR: https://github.com/AdamAbuToamy/where-i-left-off/pull/44
- Code commit: 358796f47c83fa4552a71cb45ad33d10c2dd6155
- PR quality checks: https://github.com/AdamAbuToamy/where-i-left-off/actions/runs/40793740052
- Main quality checks: https://github.com/AdamAbuToamy/where-i-left-off/actions/runs/40794385572
- Successful Hosting deployment: https://github.com/AdamAbuToamy/where-i-left-off/actions/runs/40794925794
- Worker version: 5555cb35-819c-4517-bd3e-77bbd9038358; deployed with --keep-vars, existing provider configuration preserved.
- Production read-only verification: 2026-10-29T00:37:34.321Z
- Public source fingerprint: a4814bc680015b583012cb257482f7c643280c4a47a654a83199e217f749cc7d
- Public UI bundle: SessionVoicePanel-BFqryrjZ.js
- Public speech worker: speech.worker-DlkoEyRP.js
- Model: onnx-community/whisper-large-v3-turbo, pinned revision 360ebcde2559d60bb474678be3c1de9ef347d01a, q4f16 (~565 MB).

Public HTTP checks confirmed the expected fingerprint, simplified dictation UI, pinned speech model and OPFS cache implementation. These checks did not mutate a production account or submit audio. Real local inference and microphone-pipeline persistence were verified separately on native Windows Chrome/NVIDIA using legal fixtures and emulated Firebase; a second worker initialized with upstream model requests blocked. Physical microphones, natural Syrian speech, all phones and a live cloud provider were not tested.

Validation: 1201 unit/application tests, 680 persistence/rules tests, 3 authentication-recovery tests, 874 backend tests and 48 browser tests passed. The opt-in actual-ASR browser test was skipped in Linux CI and passed separately on native Windows. Production audit has zero reported vulnerabilities after the RE2JS update. Remaining dialect/mixed-language errors and hardware/cache limitations are recorded in the readiness report.

No rules/schema migration. Roll back frontend to e3f29a6 and Worker to 9a6c9200-87c4-452f-8cb0-7b71f543e489 if needed; do not delete session data. The public model cache contains weights only, no account text or audio.

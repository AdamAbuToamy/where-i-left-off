# Approved session voice deployment — 2026-10-28

The user explicitly approved publishing after the implementation review. PR #43 was merged as 57a08166b467b4416760a095dadd6dc86e297d96.

- Firestore rules compiled and were released to project where-i-left-off-b5683 before the client rollout. Rules SHA-256: c9d2b10aa331ef207722095ab61b90311a6ca7b3e0879d9baf677a0a97b08aaf.
- Cloudflare Worker version: 9a6c9200-87c4-452f-8cb0-7b71f543e489. Existing production variables and secrets were retained with --keep-vars; no provider/account credentials were changed.
- Main quality run: https://github.com/AdamAbuToamy/where-i-left-off/actions/runs/40768906235
- Hosting deployment: https://github.com/AdamAbuToamy/where-i-left-off/actions/runs/40769547776
- Public site: https://where-i-left-off.web.app
- Verified at: 2026-10-28T21:11:52.217Z
- Published source fingerprint matches the tested source: 04d51c427106ef78777f4bca7f79ca0b0c2f5e51b8476cddac7485f5f77ce617.
- Read-only production verification retrieved the current HTML, session panel (SessionVoicePanel-DCy0xVW1.js) and actual speech worker (speech.worker-l3yxs7pl.js); the pinned model revision was present.

No production account records were created, edited or deleted for verification. Runtime transcription quality limitations remain those in the implementation report: manual correction and proposal review are essential for Arabic/Hebrew and mixed technical speech; physical-device checks remain unperformed.

Open a card, open Work session, scroll below the checkpoint fields to Session assistant, and press Start listening. First use downloads the local model/runtime. Existing open tabs may need a refresh to load the new application bundle.

Rollback can restore the previous client while retaining the additive private session collection. Do not delete users' accepted notes or transcripts during rollback. The previous production fingerprint was 4115c5204ae71e0d1cf4b2060a394efe53179ab7be70d071b396b2037b4900c6.

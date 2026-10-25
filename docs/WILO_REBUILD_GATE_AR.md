# WILO rebuild / acceptance gate (2026-10-25)

## Production protection
This branch follows the recovery branch; no deploy to production until site authentication, groups, admin accounts, university, cards and Firestore read/write work for a verified test account. Do not weaken Firestore rules, App Check, or account verification to satisfy the assistant.

## Architecture
The user sees a single assistant. The model supplies intent and arguments; deterministic domain functions do all create/update/delete/reorder operations. Browser-local WebLLM is an opt-in backend with one-time cached download and reinitialization on return (not a permanent background process). Cloud is an explicit fallback. Neither backend gets Firebase credentials or writes directly.

All requests must follow:
(1) authenticated server-verified snapshot;
(2) model structured proposal, including complete multi-step ledger;
(3) validation of tools, IDs, aliases, permissions, dates and conflicts;
(4) review and confirmation;
(5) Firestore transaction;
(6) server read and per-operation receipt.
Never show a saved/success claim from model text. Failures return stage, safe reason and a recovery suggestion.

## Gates to release
- Core site smoke tests in production with owner/test account: email sign-in, account metrics, groups, cards, university and persistence after reload.
- Local model: WebGPU support check; desktop and physical Android browser; first-time download, cache persistence/reload, insufficient memory/storage, offline mode, cancellation and recovery. Record actual GPU/browser and timings.
- 618 natural-language cases from tests/fixtures/assistant/corpus.mjs across Arabic, Hebrew and English. Run full live inference for each active provider, using oracle checks and persisted application receipts. A mocked response or emulator-only application test **does not count** as a live model pass.
- Report per-case provider/model, language, intent, planned operations, applied operations, saved state, expected effect, actual result, failure stage, reason and retry/repair behavior. Stop on regressions and re-run failed cases and full corpus.
- Do not claim 618/618 unless each provider tested demonstrates it. If browser-local 1.5B model fails, consider larger compatible model or a deterministic intent engine and retest; do not hide failures with cloud fallback.

## Existing resources
- scripts/test-assistant-live.mjs is a live provider runner for cloudflare/groq/gemini only. It does **not** yet test WebLLM browser inference.
- tests/fixtures/assistant/corpus.mjs defines 618 cases.
- tests/fixtures/assistant/oracle.ts defines evaluation.
- src/assistant/localModel.ts is experimental; mocked tests only, pending real GPU benchmark.
- Source branches: fix/wilo-receipt-references-20261025 and feature/wilo-browser-local-activation-20261025 contain previous assistant experiments and should be selectively ported after regression analysis, not merged wholesale.

## Current evidence
- No end-to-end production recovery validation is currently available from the GitHub connector.
- Local build/lint success on the older experimental branch is not equivalent to this rebuilt branch passing.
- Zero new live-model 618 tests performed in this rebuild branch yet.

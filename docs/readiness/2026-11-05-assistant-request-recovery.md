# Assistant request recovery — 2026-11-05

Scope: shared account-proxy request lifecycle, not phrase matching or a language-specific shortcut.

## Findings and changes

- HTTP 429 `assistant-busy` was incorrectly labelled as account rate limiting. It now has a distinct localized message; actual account and provider limits remain distinct and enforced.
- Browser inference expires after 25 seconds of silence, but the server previously retained its lease until upstream reading finished (or its 70-second expiry). Aborting the upstream fetch alone did not release it when a provider stalled. Cancellation/deadline now releases the account lease independently and exactly once, retaining the token-qualified update so old cleanup cannot release a newer request.
- Server silence budget is 20 seconds, preceding the browser 25-second idle deadline; arriving chunks renew it, with the existing 60-second hard ceiling. A timed-out stream carries a typed timeout instead of being interpreted as an incomplete operation proposal. Server deadline responses are not blindly retried within an exhausted browser budget.
- Credentials, account ownership, simultaneous-request exclusion, rate policies, full-proposal validation and write paths are preserved.

## Evidence

- Backend: `node --test push-worker/*.test.mjs`: 893 passed, including client abort, idle deadline and stream cancellation followed by a successful new request; account encryption/isolation, revocation and concurrent exclusion remain tested.
- Client: 25 tests passed across assistantAccountRecovery, assistantInferenceStream and assistantPollinationsClient: normal optional-tool chat, workspace actions, one bounded transient retry, cancellation, separate busy/account-limit/provider-limit/deadline classification, and typed stream expiry.
- Architecture: passed, 29 checked modules.
- TypeScript production build and credential pattern check passed. Lint: zero errors, one existing AssistantWidget cleanup-ref warning. Existing large-chunk build warning remains.
- `docs/knowledge/university/university_rules.md` is absent; no claim of applying it.

## Limits and delivery

These are injected-provider regression checks, not successful live inference evidence. No new live provider key was used, no actual account content was queried, and the screenshot alone cannot establish the provider's reason for latency. This change does not guarantee model latency/semantic accuracy, remove real provider quotas, or claim every possible request is solved. Published on explicit follow-up approval. Production release: `wilo-assistant-request-recovery-20261105`; worker version: `ca035a73-74e0-4ba6-b514-5bf45ec67985`. Hosting byte verification matched all seven checked files, including the assistant chunk. See `2026-11-05-assistant-recovery-production.json`. Live inference remains unverified.

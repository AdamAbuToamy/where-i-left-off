# Admin motion revision and abandoned callback URL cleanup — 2026-11-04

## Requested sequence and rollout

Completed and deployed the expanded admin design first (`wilo-admin-motion-20261104`). Then implemented the callback cleanup requested from the screenshot. Visual changes remain restricted to the existing verified administrator account. URL cleanup applies to all visitors; it does not grant access or change account bindings.

## Admin design

- Staggered card entrance, subtle pointer-responsive paper surface, tactile button press and hover, animated disclosure/menu appearance, saving spinner and saved check, settings/course selection treatments.
- Motion is scoped to the admin study, respects reduced motion, and does not add network/AI work. Dragging disables card tilt/entrance. Entrance clipping is not retained after the animation, so card controls are not permanently clipped.
- Short Open/فتح card actions retain the full accessible expansion label. Empty-card explanatory copy is omitted only in the admin summary; original details remain mounted.
- One-line card previews and fewer duplicated headings. Full next step/description remains in expanded details.
- Compact sync chip replaces the long inline admin sync sentence; full queued/offline detail remains in an explicit Info disclosure and accessible status name. Error/conflict notices remain visible. No permission, consent, destructive confirmation or error message was blanket-hidden.
- Existing public design remains unchanged for normal accounts. No new runtime dependency, data migration or business rule was introduced.

## URL finding and fix

The screenshot alone does not prove compromise. `code` is used by OAuth authorization-code flows and `state` correlates a request; the presence of those names is not a website password or proof of an API key disclosure. WILO's active Pollinations flow already uses device authorization, saves the provider key through the account-owned encrypted server endpoint, and does not consume a root-page `code/state` callback. Legacy OpenRouter source exists but is not called by the active app entry/UI.

Added `cleanStaleAuthorizationUrl`, a small pure URL transformation, and a Vite HTML hook that executes it at the beginning of the head, before application module execution and diagnostics. It removes abandoned root callback parameters (`code`, `state`, old WILO OpenRouter marker and OAuth error details) while retaining the hash route, unrelated query parameters, and history state. It replaces the current history entry instead of adding a redirect/reload or a new history item.

Scope is deliberately narrow: only `/` and `/index.html`, only paired callback parameters or the explicit obsolete marker. Firebase reserved handlers, email action links (`oobCode`, or `mode` plus `apiKey`), other public paths, standalone ordinary `code`/`state` parameters, group invitations and app routes are preserved. No code exchange, new storage, logging of values, automatic reconnect or credential rotation was added. Existing Referrer-Policy and authorization checks remain intact.

This removes values from the current browser address after HTML begins executing. It cannot retroactively remove an already received initial URL from hosting/browser infrastructure, previously copied links or screenshots. No exploit or account compromise was demonstrated, and no broad security certification is claimed.

## Verification

- Unit/application: 1,267 tests across 119 files passed, including cleanup preservation/duplicate-parameter tests and the existing PKCE tests.
- Browser: 3 admin-study/isolation journeys passed, including admin Arabic phone reload, concise labels, full sync details, expansion/collapse, reduced motion and no horizontal overflow. A separate ordinary-account Arabic phone layout journey passed. Earlier failures came from stale fixture selectors and a fixture forcing English on reload; the tests now follow the existing View tools and language-segment UI.
- Browser URL cleanup: 2 passed. One blocks all application JS assets and proves the head script still cleans the synthetic URL and preserves history state/hash; the other verifies the normal sign-in fields remain usable.
- TypeScript passed. Lint zero errors and one unchanged pre-existing AssistantWidget ref-cleanup warning. Architecture 22 modules, zero violations.
- Production build/source and dist credential checks passed. Existing large-chunk warning remains.
- Authentication recovery result and final deployed byte checks are recorded in the accompanying production proof.
- No rules/backend/provider/physical-device suites were rerun for these frontend-only changes. No live provider authorization was performed or revoked.

## References

- https://openrouter.ai/docs/guides/overview/auth/oauth
- https://developer.mozilla.org/en-US/docs/Web/API/History/replaceState

## Rollback and decision

READY for admin visual review and release of the narrowly scoped URL cleanup after final Hosting verification. Hosting rollback to `wilo-admin-motion-20261104` retains the expanded design and removes only the new callback cleanup build. Rollback to `wilo-admin-kitchen-seo-20261104` returns to the earlier admin study. No data migration or worker rollback is needed. Google Search Console processing remains unverified as recorded in the earlier report; this task does not change that status.

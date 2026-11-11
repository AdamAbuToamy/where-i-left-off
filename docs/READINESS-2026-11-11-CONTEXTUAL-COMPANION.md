# Contextual Wilo companion — 2026-11-11

## Scope and behavior
The existing onboarding character now offers occasional contextual suggestions in Arabic, Hebrew and English. Settings → Wilo companion includes an immediate master opt-out, independent deadline/stale-item/feature/Chrome switches and gentle/normal frequency. Opt-out does not change Push, reminders or onboarding preferences. Settings are explicitly local to this browser and account; they do not synchronize between devices. Storage failure displays a warning while opt-out still applies in memory.

Suggestions require at least 30 seconds in the signed-in shell and 5 seconds of inactivity. Gentle: at most two appearances per rolling 24 hours and a 60-minute cooldown. Normal: three and 20 minutes. Resource tips are suppressed for seven days, feature announcements once per release, and Hide for a day pauses for 24 hours. Re-enabling the master switch clears the day pause. A tip closes after 60 seconds unless it holds keyboard focus. It does not interrupt typing, dialogs, onboarding, loading, offline state or sleeping private content. The existing mascot respects reduced motion and animation settings; spontaneous suggestions are silent.

Authorized snapshots come only from the currently mounted, synchronized personal/university UI. There are no additional Firestore subscriptions, background content scraping, AI calls, server writes or Push messages. Metadata stores bounded resource IDs/timestamps/preferences, never account titles or prompts. Near-deadline suggestions require an actual future due date within three days. Stale suggestions require an actual locally recorded card/course visit at least 14 days ago: unknown historical visits are not guessed. Groups are not scanned for resources. Show me alone navigates, reveals the target and opens the existing card/editor; it does not save changes.

The old persistent Chrome banner is removed from the signed-in shell. Occasional offers reuse existing published configuration, Chromium detection, installation detection, snooze/dismissal and store URL helpers. Installed/unsupported/unpublished cases remain suppressed, with focus/online rechecks. Settings retains the existing extension management UI. Future release announcements edit src/companion/release.ts and corresponding localized feature/here copy in text.ts.

## Boundaries and recovery
No backend, API contract, scheduler, rules, database schema, dependency or authentication changes. Companion remains inside AccountLifecycle private-content so sleeping hides account text. University helper reminder records remain excluded by the existing card visibility filter. The small university hash-state correction permits existing deep links to open an assignment on an already mounted page.

Recovery source/history: /home/adam/wilo-recovery/20261111-contextual-companion. The recovery working copy /home/adam/wilo-test is unchanged. Production verification is read-only, without signing in, creating API keys, changing cards or sending Push.

## Verification evidence
Results and deployment evidence are recorded below after checks finish. Synthetic emulator accounts only. Desktop and phone screenshots were visually reviewed; actions and close controls remain inside viewport and above navigation.

The abandoned fake-clock Chrome test was preserved outside Git after its bounded retries: virtual time interfered with configuration fetch timeout. The replacement uses actual UI timing. This is test-harness behavior; production timeouts were not weakened.

Historical workspace/university browser suites have pre-existing outdated UI expectations (docs/QUALITY-2026-11-11.md); they are not claimed green. Worker/rules are unchanged; earlier 978 Worker and 694 rules results are historical, not rerun evidence for this release. Physical-device delivery and authenticated real-user production behavior are not tested. Local emulators cover authenticated behavior; published asset parity covers deployment.

## Completed local checks
- Full application suite: 1395/1395, 156 files, /tmp/wilo-companion-app-final.log.
- Focused shell/policy/settings/storage failures: 13/13, /tmp/wilo-companion-targeted-final.log.
- Browser: 16 distinct selected journeys passed across the broad run (14 passed, 2 failed due frozen clock before React consumed real Firestore I/O) and final contextual rerun (5/5). The corrected test advances scheduler ticks while polling feed consumption; production timing remains unchanged. Evidence: /tmp/wilo-companion-browser-complete.log and /tmp/wilo-companion-browser-targeted.log. Covers desktop/phone light/dark detail panels, persistent opt-out, due/stale/feature/course suggestions, real-time Chrome offer/dismissal, universal reminders, university separation and onboarding. This is not an all-historical-E2E pass.
- Full ESLint and latest focused ESLint passed. TypeScript build passed. Architecture: 44 modules, zero violations. Credential pattern check passed (not a complete secret audit).
- No backend or security-rule changes; their historical results are distinguished above.

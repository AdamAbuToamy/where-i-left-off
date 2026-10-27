# University default release — 2026-10-28

## Scope and behavior
The approved University presentation is now the default for every verified account at `#/university`. Remove the administrator/preview gate, experiment notice, entry and return links, and unused legacy overview branch. Existing `preview=1` links still open the same page; normal University navigation no longer adds this flag.

Keep the approved course panels, notes/links, task search and filters, day/week schedule, original prerequisite/UML graph and animation preferences. Preserve the course destination marker consumed by the existing assistant change reveal. The assistant, personal cards, navigation shell, authentication/provider integrations, persistence, account isolation, validation, reminders and offline/conflict flows are unchanged. Source changes are confined to `src/university`.

## Data and recovery
No schema change, migration, account-data replacement or automatic write. Users continue using their actual University data through the existing save flow. Reverting this release restores the preceding administrator-only trial; it does not revert any user edits or reintroduce the rejected multi-page redesign.

## Verification
Local verification and exact-head CI results are recorded before deployment. Browser journeys use disposable Firebase emulator accounts and injected model responses, including a regular non-administrator opening the new default view and a legacy preview link. No real provider credits or production account edits are used. Physical devices and other browser engines are not newly certified.

### Local evidence
- `npm test`: 1130 passed / 95 files.
- Browser/emulator journeys: all 41 passed, including default University access for non-administrators, legacy-link compatibility, original assistant/menu/cards, UML, linked notes, task filters, study-topic saving/reload and mobile day/week views. Approved mobile presentation visually reviewed.
- `npx tsc -b`: passed.
- `npm run lint`: zero errors; one unchanged AssistantWidget ref-cleanup warning.
- `npm run check:architecture`: passed.
- `git diff --check`: passed. No application-source differences outside `src/university`.
- Production `npm run build`: passed; credential-pattern check passed for 632 source/asset files. Existing bundle-size advisory remains.

Rules/persistence, auth-recovery, worker and dependency checks run through the required exact-head CI gate. Their implementations are unchanged by this presentation rollout. CI and deployment evidence will be linked on the release PR; unperformed checks are not counted as passed here.

# University-only trial and original-app restoration — 2026-10-27

## Scope
The multi-page interface preview from PR #36 is reverted. The assistant, side/options menu, personal cards, global appearance, routing, authentication/provider helpers and other pages are restored to the pre-preview baseline (`e078f5749f7a434fc576f6f2e8ffc83d3f4b6c9f`, whose tree matches the pre-Studio release).

New application-source changes are restricted to `src/university`. The source-scope check passes:

```sh
git diff --exit-code e078f5749f7a434fc576f6f2e8ffc83d3f4b6c9f -- src ':(exclude)src/university/**'
```

The administrator can opt into `https://where-i-left-off.web.app/#/university?preview=1`. A verified non-administrator sees the original university page even with this parameter. The entry and return link are inside University; no new application shell, assistant, menu, card renderer, private account copy or persistence service is introduced.

## Behavior
- Keep the original complete application shell, original assistant/options, original personal cards and navigation.
- Restore the existing course prerequisite/UML map, SVG relationships, edit actions and pointer movement. The trial retains the original map rather than replacing it with a list.
- Add compact university tools/statistics, stable course identity colors, selected-course context in the URL, and separate overview/tasks/materials/study-plan panels.
- Add search and type/status/overdue filters, twenty-row task pagination, next-class context, linked course notes and the existing saved materials/study topics.
- Add a phone day agenda alongside the existing hourly week view. Both use the original lesson editor and schedule builder.
- Reuse the original university forms, validation, repository, offline queues, revision/conflict handling, reminders, JSON import/export and deletion undo. The existing CourseContent defaults to its original all-content rendering outside the trial.

## Data and rollback
This is a **presentation trial using the real signed-in account data and its original saving flow**. Saving an edit changes that account's university data, exactly as on the normal university page. This is stated in the trial notice. There is no automatic copy, migration, sample-data replacement or production-data edit performed by deployment or verification.

Returning to `#/university` immediately restores the original university presentation. It does not undo deliberate data edits. Original backup/export, deletion undo, synchronization and conflict controls remain available.

For source rollback, remove only the scoped university additions or restore `src/university` to the baseline while retaining the explicit revert of PR #36. Reverting the entire combined restoration release would reintroduce the rejected multi-page preview and is not the intended rollback.

## Verification
| Check | Result |
| --- | --- |
| `npm test` | 1130 passed across 95 files |
| `node --test push-worker/*.test.mjs` | 867 passed; worker source unchanged |
| `node scripts/run-browser-tests.mjs` | All 41 journeys passed, including 3 new university/restoration journeys |
| `npm run test:rules` | 675 passed across 14 files, Firestore emulator / Java 21 |
| `npm run test:auth:recovery` | 3 passed, Auth emulator |
| `npm run lint` | No errors or new warnings; existing AssistantWidget ref-cleanup warning retained |
| `npx tsc -b` | Passed |
| `npm run check:architecture` | Passed; no new domain or persistence boundary |
| Production build / credential pattern checks | Passed; existing public bundle-size advisory retained |
| Source scope against original baseline | No differences under `src` outside `src/university` |

The new Chromium journeys open the original navigation, original assistant and its options, an actual emulator-backed personal card and its options, and the UML relationships. They also verify task filters, linked course notes, topic completion through the original synchronization flow, reload persistence, daily/weekly phone schedules, no horizontal overflow, a scoped axe WCAG2/2.1 AA check, and non-admin fallback. Desktop/mobile UML and overview screenshots were visually reviewed.

The original provider is unchanged. Live model accuracy, a new 618-prompt evaluation, real OAuth consent, physical-device push/PWA behavior and Safari/Firefox are not newly certified by these emulator/Chromium tests. Production verification is read-only; no production account edits are part of the release checks.

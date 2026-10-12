# Verification results — 2026-10-13

The validated source is commit [`f0a16bc`](https://github.com/AdamAbuToamy/where-i-left-off/commit/f0a16bc). GitHub Actions run **#5** completed successfully: both `verify` and `dependency-audit` passed. [Workflow history](https://github.com/AdamAbuToamy/where-i-left-off/actions/workflows/ci.yml).

Tests use demo Firebase emulators, not production user accounts.

| Check | Observed result |
| --- | --- |
| ESLint | Passed locally and in CI |
| TypeScript + production build + service worker generation | Passed |
| Unit tests | 20 passed |
| Firestore security/repository tests | 14 passed |
| Browser suite | 10 passed in each of three consecutive local runs; CI verification passed |
| Tooling compatibility | Rules-file watching, UUID v4, trace propagation and Pub/Sub construction passed |
| Full-tree npm audit | 0 known vulnerabilities in the local run |
| CI dependency audit | Passed at high/critical threshold |
| Local WSL verification | Completed with RECALL_VERIFICATION_COMPLETE and WSL_EXIT_CODE=0 |

These are **44 distinct test cases**; three browser runs are repeated executions of the same 10 cases, not 30 distinct cases. No skipped suites or automatic retries were used to make the failed checks pass.

## Browser coverage

Creation at phone viewport size; multi-session persistence; edits, ordering and deletion; three languages and horizontal overflow; tab capture; sections, checkpoints and checklists; offline reload and reconnect; concurrent edit conflict choices; offline account isolation; group assignment/membership and queued progress; shared invite routing; literal rendering of untrusted markup-like text.

## Security coverage

Own-data access and rejection of other users/anonymous clients; invalid fields, URL protocols, sizes, revisions and timestamps; verified admin identity and restricted metrics/suspension; rejection of self-escalation and tampering; group ownership, membership, assignments and creation permission; invitations, revocation and deletion; blocked queued changes after revocation.

## Findings resolved during verification

- A rejected stale offline write could surface a permissions error instead of conflict choices. The app now rereads the server document after permission-denied; it reports a conflict only when the document differs from the queued base. Unchanged-document permission errors remain errors. Firestore rules were not weakened.
- gRPC, FTP and remaining CLI dependency findings were remediated through reviewed scoped overrides. The audit still examines the full dependency tree. See [tooling compatibility and scope](docs/TOOLING_SECURITY.md).

Earlier failed CI runs remain part of the history. They do not describe the status of the validated commit.

## WSL stability observation

Before the successful run, Windows had a fixed 2 GiB pagefile and little available virtual memory. System-managed paging was enabled and, after reboot, Windows allocated a 6400 MiB pagefile. Dependency installation then completed, followed by three successful browser runs with software-rendering flags. These results demonstrate stability under that tested configuration; they do not isolate paging or GPU settings as the sole cause of the earlier crashes, or prove all future WSL workloads stable.

## Why skipped tests appeared in an earlier version

Emulator-dependent tests were previously included in the default unit command and skipped when no emulator was configured. They now have explicit separate commands:

```bash
npm test             # unit tests
npm run test:rules   # Firestore emulator security/repository tests
npm run test:e2e     # Auth + Firestore + Chromium
npm run test:all     # lint, unit, rules, browser, production build
```

Requesting the security suite without a Firestore emulator fails rather than silently skipping it.

## Limits

This is not complete test coverage or a penetration-test certificate. Real Google OAuth, native Android/iPhone installation and share sheets, production IAM, abuse resistance and load/quota behavior are outside these automated results. An audit result is a timestamped check against known advisories, not a guarantee against undisclosed vulnerabilities. The live hosting deployment and Firestore rules release were confirmed separately before the tooling-only update.

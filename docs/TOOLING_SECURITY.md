# Tooling security maintenance

## Current review — 2026-11-07

The notes below describe a historical baseline, not the currently installed dependency tree. The current lockfile audit reports **zero runtime advisories**, and **23 moderate development-tool advisories** (no high/critical). See the dated video review for the actual verification. Current CI blocks high/critical runtime and tool vulnerabilities; it does not claim the full tree is advisory-free.

Current affected development chains include glob/minimatch, UUID and OpenTelemetry under Firebase CLI and ESLint. `npm audit fix --force` proposes major downgrades; those were not applied. Historical scoped overrides below are not currently active except the gRPC/basic-ftp entries visible in package.json. Do not treat these old notes as proof that a vulnerable version is patched. Re-evaluate supported upstream fixes and test CLI/emulator compatibility before changing the toolchain.

## Historical maintenance notes

The application, Firestore rules and production UI were unchanged by that historical update.

Scoped overrides:
- firebase-tools -> chokidar 4.0.3 removes braces and its unpatched recursive-pattern vulnerability. This project's Firestore watcher uses a literal rules-file path, supported by Chokidar 4. Firebase Functions watchers can depend on glob ignore patterns removed in Chokidar 4; review this override before adding Functions or glob-based watching.
- gaxios -> uuid 11.1.1 retains CommonJS and the v4() API consumed by gaxios. Avoid UUID 12+ in this CommonJS dependency chain.
- @google-cloud/pubsub -> @opentelemetry/core 2.8.0 fixes baggage parsing while retaining W3CTraceContextPropagator, the only core export imported by the installed Pub/Sub implementation.
- Existing gRPC 1.14.6 and basic-ftp 6.2.3 overrides remain.

`npm run test:tooling` verifies the actual CLI dependency resolution: literal-file change detection, UUID format, trace injection/extraction, and Pub/Sub construction. It runs in CI, followed by the project's rules and browser suites. These checks do not certify unrelated Firebase CLI features or FTP transfers.

Validated baseline f0a16bc (2026-10-13): both CI jobs passed. Full-tree local audit reported 0 known vulnerabilities. Lint, tooling checks, 20 unit tests, 14 security/repository tests, three consecutive runs of all 10 browser tests, and the final production build passed on the maintainer's computer. See TEST_RESULTS.md for scope and evidence.

WSL investigation: `scripts/test-wsl.ps1` runs the same tests three times with software rendering flags, writes the transcript to Windows Downloads, and builds production only after success. It does not modify WSL system configuration, data, or browser security sandbox defaults. After enabling system-managed Windows paging (previously fixed at 2 GiB), installing dependencies and running three complete browser rounds with software rendering succeeded. That observation does not isolate paging or GPU settings as the sole cause. If WSL terminates again, preserve the Windows transcript and collect official WSL diagnostics.

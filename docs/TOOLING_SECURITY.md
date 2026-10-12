# Tooling security maintenance

The application, Firestore rules and production UI are unchanged by this update.
The full npm audit remains blocking in CI; no advisories are ignored.

Scoped overrides:
- firebase-tools -> chokidar 4.0.3 removes braces and its unpatched recursive-pattern vulnerability. This project's Firestore watcher uses a literal rules-file path, supported by Chokidar 4. Firebase Functions watchers can depend on glob ignore patterns removed in Chokidar 4; review this override before adding Functions or glob-based watching.
- gaxios -> uuid 11.1.1 retains CommonJS and the v4() API consumed by gaxios. Avoid UUID 12+ in this CommonJS dependency chain.
- @google-cloud/pubsub -> @opentelemetry/core 2.8.0 fixes baggage parsing while retaining W3CTraceContextPropagator, the only core export imported by the installed Pub/Sub implementation.
- Existing gRPC 1.14.6 and basic-ftp 6.2.3 overrides remain.

`npm run test:tooling` verifies the actual CLI dependency resolution: literal-file change detection, UUID format, trace injection/extraction, and Pub/Sub construction. It runs in CI, followed by the project's rules and browser suites. These checks do not certify unrelated Firebase CLI features or FTP transfers.

Local validation of this update: npm audit (full tree) reported 0 vulnerabilities; lint, all 20 unit tests, TypeScript/production build and tooling compatibility passed. Rules/E2E must be verified by the updated CI run: local Java/browser downloads in the editing environment were incomplete.

WSL investigation: `scripts/test-wsl.ps1` runs the same tests three times with software rendering flags, writes the transcript to Windows Downloads, and builds production only after success. It does not modify WSL system configuration, data, or browser security sandbox defaults. GPU isolation is an experiment, not a confirmed diagnosis. If WSL terminates again, preserve the Windows transcript and collect official WSL diagnostics; do not label it fixed.

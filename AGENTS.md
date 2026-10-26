# Repository engineering instructions

Read PROJECT_ENGINEERING_GUIDELINES.md at the repository root and apply it to new work and reviews of existing code. User requirements take precedence. Audit and improve existing boundaries incrementally; do not rewrite working features merely to change their shape.

## Project context
React 19, TypeScript 6, Vite 8, Firebase Authentication/Firestore, and a JavaScript Cloudflare worker. Use the installed Node 24 runtime and the lockfile. The production site is where-i-left-off.web.app.

## Boundaries and integrity
- Keep domain invariants in the existing entities, validators and task planners. UI and external-model responses cannot bypass them.
- Keep model inference separate from saving. Validate the entire proposal before presenting Apply; never execute partial streamed tool arguments.
- Application orchestration receives explicit collaborators. Concrete Firebase, provider, browser and HTTP integrations belong at outer boundaries.
- Preserve account isolation, revision checks, offline queues, and atomic writes. Do not weaken rules to satisfy a test.
- Treat all third-party/model data as untrusted. Never log API keys, account content or prompts in timing diagnostics.
- Preserve unrelated work. Record existing architecture debt and fix it proportionally to the affected capability, without speculative layers.

## Verification
- Unit/application: npm test
- Rules/persistence: npm run test:rules with Java 21 and the Firestore emulator.
- Authentication recovery: npm run test:auth:recovery
- Browser journeys: node scripts/run-browser-tests.mjs; use an isolated preview port if a development server occupies 5173.
- Backend: node --test push-worker/*.test.mjs
- Architecture: npm run check:architecture
- Quality/build: npm run lint, npx tsc -b, production npm run build, credential checks.
- Distinguish live-provider checks, injected-provider emulator tests, production read-only checks, and physical-device/store checks.
- Keep a dated readiness report with evidence and unresolved limitations. Never mark an unperformed check as passed.

# Where I Left Off — WILO

[![Quality checks](https://github.com/AdamAbuToamy/where-i-left-off/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/AdamAbuToamy/where-i-left-off/actions/workflows/ci.yml)

**Save the link, remember where you stopped, and know your next step.**

A multilingual project and study organizer for personal cards, shared work, university courses and weekly schedules. WILO combines account synchronization and offline editing with a cloud assistant that prepares changes for your review.

**[Open the app](https://where-i-left-off.web.app/)** · **[العربية](README_AR.md)** · **[Readiness checklist](docs/READINESS_AR.md)** · **[Security](SECURITY.md)**

## Current status

The public assistant is available to signed-in users with a verified email. Each user connects their own Pollinations account through the consent flow in the app. The configured model is DeepSeek V4.1 Flash. Provider free credits, rate limits and availability apply.

The automated readiness checks passed. Real Google/Pollinations consent, Chrome Web Store installation and physical-device PWA/push delivery still require device verification. The [54-point readiness checklist](docs/READINESS_AR.md) distinguishes completed checks, known limits and manual checks.

<!-- recall-media:start -->
## Promotional preview

<a href="docs/media/README.md"><img src="docs/media/images/resume-en.png" width="360" alt="Where I Left Off promotional illustration"></a>

Promotional illustration; not a screenshot of the live interface.

**[English video](docs/media/videos/promo-en.mp4)** · **[Arabic video](docs/media/videos/promo-ar.mp4)** · **[Full media gallery](docs/media/README.md)** · **[Phone installation illustrations](docs/media/README.md#phone-installation-illustrations--رسومات-تثبيت-الهاتف)**

<!-- recall-media:end -->

## Features

| Area | What you can do |
| --- | --- |
| Cards and sections | Save links, notes, checkpoints, next steps, checklists, progress and follow-up dates |
| Views | Search, filter, reorder cards and review a week or today's work |
| Offline editing | Keep edits across reloads, synchronize on reconnect and explicitly resolve conflicts |
| Shared groups | Invite members, assign work and control member creation permissions |
| University | Organize courses, topics, assignments, exams, prerequisites and recurring lectures/tutorials/labs |
| Assistant | Ask about your data, request summaries and prepare supported changes across the app |
| Downloads | Request PDF, TXT, Markdown, CSV and JSON reports |
| Capture | Save supported browser tabs, video timestamps and recognized Moodle pages with an import preview |
| Languages | Arabic, Hebrew and English, with RTL/LTR layouts |
| Interaction | Page/card/dialog transitions, consistent icons, keyboard controls and reduced-motion support |
| Installed app | PWA installation and opt-in reminders, subject to supported devices and deployment setup |

## Using WILO

1. [Open WILO](https://where-i-left-off.web.app/) and sign in.
2. Create a card with its link, checkpoint and next step.
3. Add a section, checklist or date when useful.
4. Use the same account on another device to continue.
5. Open the assistant, choose **Connect assistant**, sign in and approve the Pollinations connection.

Open and sign in online before relying on offline editing. Queued changes synchronize while the application is open and connected. The assistant requires a network connection.

For installation and capture, see the [phone guide](docs/INSTALL.md) and [extension guide](browser-extension/README_AR.md).

## The assistant

Ordinary conversation stays conversational. When account data or an app operation is needed, the model selects existing typed functions. The app reads authorized records in bounded pages, validates the complete proposal and presents **Apply changes**. Only confirmed saves are shown as saved.

The assistant supports compound requests, follow-up details, relative dates and supported site settings. Streamed tool arguments are assembled completely before validation; partial output cannot trigger a write. Users can stop a pending request. Connection diagnostics report stage timings without including prompts, account content or API keys.

Examples:

> أضف بطاقة مشروع البرمجة لقسم هالأسبوع، وخلي موعدها 28 الشهر، واعمل مراجعة قبلها بيومين.

> Summarize my courses and give me a PDF.

Important limits:

- Provider latency and free allowances vary; there is no unlimited-service guarantee.
- Web search and finding the first YouTube video are unavailable. Supply a direct URL when needed.
- Account security, browser permissions and group membership changes use their original interfaces.
- PDFs currently contain rendered pages, so their text is not searchable or selectable.
- Natural-language understanding is not guaranteed for every request. Review proposed changes.

The production assistant uses each user's cloud authorization. Legacy local-model/provider experiments retained in the repository are not the active production setup.

## Architecture and engineering

| Boundary | Responsibility |
| --- | --- |
| Domain and application | Validated entities, task plans, university state and offline orchestration |
| Ports | Workspace persistence, remote operations, connectivity and synchronization locks |
| Adapters | Firebase, IndexedDB, browser events, provider HTTP/SSE and file generation |
| UI/composition | React screens, account-scoped dependency wiring and review/apply interactions |

The core dependency check follows runtime imports from four critical entry points across 14 modules. It prevents browser drivers and external frameworks from leaking into those business/application paths. Compatibility exports preserve existing imports and storage formats.

See the [engineering baseline](PROJECT_ENGINEERING_GUIDELINES.md), [repository instructions](AGENTS.md), [architecture](docs/ARCHITECTURE.md) and [streaming/boundary decision](docs/adr/2026-10-26-streaming-and-core-boundaries.md).

## Run locally

Requirements: **Node.js 24**, npm, and **Java 21** for Firestore emulator tests.

    npm ci --include=dev
    cp .env.example .env.local
    # Set your Firebase web configuration in .env.local.
    npm run dev

Enable Firestore and the Email/Password and Google sign-in providers in your Firebase project. Configure authorized origins and App Check for the intended deployment. Browser identifiers are public configuration; service-account credentials and provider secrets must never be committed.

For the demo Firebase emulators, use separate terminals:

    npm run emulators
    VITE_ASSISTANT_ENABLED=true npm run dev:emulator

Browser tests inject provider responses and use disposable emulator accounts. Real inference tests require a separately authorized scoped test key; never put it in browser source, fixtures or Git.

Forks should configure their own Firebase deployment and Pollinations application. The bundled public Pollinations client identifier belongs to the existing WILO deployment.

## Verification

    npm ci --prefix push-worker
    npx playwright install --with-deps chromium
    npm run lint
    npx tsc -b
    npm run check:architecture
    npm test
    npm test --prefix push-worker
    npm run test:rules
    npm run test:auth:recovery
    npm run test:e2e
    npm audit --omit=dev

Run browser tests and production builds sequentially: both write dist. The default browser preview uses port 5173; use an isolated preview configuration when that port is occupied.

Recorded readiness results on **26 October 2026**:

| Check | Passed cases |
| --- | ---: |
| Unit/application | 1,123 |
| Firestore rules and persistence | 675 |
| Worker | 867 |
| Browser journeys | 37 |
| Auth recovery | 3 |
| **Automated total** | **2,705** |

Three additional live-provider scenarios covered a greeting, card creation and a compound request with PDF. This was not a fresh live rerun of the 618-prompt matrix. Injected-response tests establish application behavior and persistence, not universal model comprehension.

The recorded production dependency audit found no advisories. Five moderate entries remained in Firebase development tooling. Check the [current Actions runs](https://github.com/AdamAbuToamy/where-i-left-off/actions) and [readiness evidence](docs/readiness/2026-10-26.json) for scope and outstanding checks.

## Deployment

Production builds require the intended Firebase configuration and App Check:

    VITE_USE_EMULATORS=false VITE_TEST_OFFLINE=false VITE_REQUIRE_APP_CHECK=true VITE_REQUIRE_FIREBASE_CONFIG=true VITE_ASSISTANT_ENABLED=true npm run build

The Hosting workflow deploys the existing production target after successful quality checks on current main. Manual releases also require successful checks for that commit. It preserves public Firebase/App Check configuration and does not deploy a shared assistant key.

Opt-in Web Push uses a separately configured Cloudflare Worker, D1 and Queues. Hosting deployment does not replace that Worker. See the [push setup and device checks](docs/PUSH_NOTIFICATIONS_AR.md).

## Scope

Permanent Moodle account synchronization, external reply monitoring and binary attachment uploads are not implemented. Account-scoped caching cannot guarantee remote erasure from an offline device. Physical-device checks and operational limitations are documented in the readiness checklist.

[Privacy](https://where-i-left-off.web.app/privacy.html) · [Extension privacy](docs/EXTENSION_PRIVACY.md) · [Earlier test history](TEST_RESULTS.md)

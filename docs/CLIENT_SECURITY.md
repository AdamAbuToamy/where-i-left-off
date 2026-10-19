# Browser configuration and credential protection

| Value | Expected location | Secret? |
| --- | --- | --- |
| Firebase Web API key, project/app IDs, auth domain | Approved `VITE_FIREBASE_*` variables | Public identifiers |
| reCAPTCHA Enterprise site key | `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY` | Public site identifier |
| Firebase Admin service-account private credential | Server/CI `FIREBASE_SERVICE_ACCOUNT` | Yes; never browser configuration |
| SMTP authentication configuration | Server/CI `SMTP_CONFIG` | Yes; never browser configuration |
| Any future paid-service private API key | Server or serverless runtime | Yes; expose an authenticated, authorized endpoint instead |

Vite embeds `VITE_*` values in browser assets. `.env.local` prevents accidental Git tracking, not browser visibility. Firebase Web identifiers are designed for client use; data access is controlled by Authentication and Firestore rules. App Check adds application attestation; it does not replace user/resource authorization.

The shared configuration parser rejects unknown public variables, obvious private credential material and malformed identifiers/flags without printing their values. `prebuild` scans tracked code and browser source/public assets for credential patterns; the build also scans generated assets. CI repeats the tracked/source check. Pattern scanning is a guard, not an exhaustive detector or a replacement for rotating a genuinely leaked secret.

The production deployment script requires complete Firebase configuration and an App Check site key and refuses emulator mode. The ordinary build still supports unconfigured setup mode and isolated demo builds. These flags do not configure enforcement remotely.

## Cloud settings that require account-side verification

1. In Google Cloud Credentials, verify the browser key belongs to this Firebase project and is restricted to the required Firebase APIs. Do not permit unrelated billable APIs, particularly the Gemini Developer API, on that public key. Use a separate restricted key for other services.
2. Verify authorized Firebase Authentication domains and the reCAPTCHA Enterprise website registration match the actual deployment domains. Test restriction changes before modifying a production key.
3. Register the web app with App Check, verify valid request metrics, and confirm enforcement for the services used. A site key in a build does not prove enforcement is enabled.
4. Deploy and verify the Firestore rules. Rule emulator tests demonstrate local behavior, not what is currently deployed.
5. Keep server credentials in protected runtime/CI secrets with least privilege. If a private credential was previously exposed, revoke/rotate it; deleting its current source text is insufficient.

No authenticated Google Cloud/Firebase administrative session was available during this review. The live key's project association, API restrictions, authorized domains, quotas and App Check enforcement were not inspected or changed. No live API key value was printed, rotated or claimed to have been validated against Google.

References: [Firebase API keys](https://firebase.google.com/docs/projects/api-keys), [Vite environment variables](https://vite.dev/guide/env-and-mode), [App Check Enterprise setup](https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider).

# Browser-provided cloud dictation — 2026-10-29

## Provider research and decision

Reviewed the [public GitHub API catalog](https://github.com/public-apis/public-apis) and official provider documentation. [Groq speech](https://console.groq.com/docs/speech-to-text) uses API keys and has [quotas](https://console.groq.com/docs/rate-limits). Puter's tutorial advertises unlimited transcription, but its [quota documentation](https://docs.puter.com/rate-limits-and-quotas/) and User-Pays model do not establish unlimited free end-user usage. Pollinations' live audio catalog exposes priced transcription models; it is not an unlimited free service. No leaked/shared personal API key, key rotation, private endpoint extraction or account/rate-limit bypass was used.

The shipped route uses the official [SpeechRecognition browser API](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition). It needs no WILO provider key, model download, additional service account or backend deployment. Chrome can use a server-based recognition engine. The application explicitly requests cloud processing when the property exists. It cannot pin or claim to choose the browser vendor's underlying model, nor promise superior recognition quality or unlimited service. It requests Palestinian Arabic, Hebrew and English locales.

## Implementation

An application controller receives an injected recognition port; the concrete browser adapter owns vendor events and globals. Recording is bounded to 24 seconds after native capture starts; startup and finalization have deadlines. Interim results replace previous hypotheses, phrases are retained across bounded automatic restarts, and only an explicit stop produces a reviewable text draft. Network/service failures are labeled rather than treated as a successful complete recording. Any available partial text remains an unapproved draft. Cancellation/session disposal removes callbacks and ignores stale events.

Audio consent is explicit before the first start and stored per signed-in UID. No engine starts on page/session open or merely enabling consent. Text saving remains explicit, using existing session domain validation, account isolation and revision checks; note plus transcript are one session proposal. A card next step uses the existing revision-checked callback. No audio is sent through WILO's backend or Pollinations. Browser/vendor retention behavior is outside WILO's control. The browser API does not expose a reusable raw recording; a failed recognition can require recording again.

## Verification and limitations

- Final GitHub application suite: 1,223 passed. The separate focused cloud controller/adapter suite passed 9 tests, including cancellation, ordering, interim replacement and incomplete-stop acknowledgement. Three emulator-backed session browser journeys passed with injected recognition; these do not establish vendor accuracy. Lint (one pre-existing AssistantWidget warning), TypeScript, architecture, credential checks and production build passed.
- Native Windows Chrome synthetic-fixture probes established API availability/event completion but did **not** establish correct transcription: the Arabic probe returned different words and the English probe returned no transcript. Fake audio support in the native recognition path was not established. These probes are not reported as successful accuracy evidence.
- Physical-microphone Arabic/Palestinian/Hebrew/English accuracy and vendor behavior require real-device verification. No accuracy percentage, guaranteed provider model or unlimited-service claim is made.
- Legacy local-model audio journey is explicitly skipped for this release, not repurposed as cloud evidence. Historical local-model reports remain valid only for their prior releases.
- Firefox/other unsupported browsers show a clear unsupported message; manual notes/checklist remain usable. Cloud availability, browser permission and network reliability can fail.

No Firestore rule/schema/backend changes. Old local weights are preserved, not automatically downloaded or removed. Frontend rollback to `1e18fe3` restores the local-message experience with its existing cache. Production and final CI results are recorded after completion.


## Publication evidence

[PR #48](https://github.com/AdamAbuToamy/where-i-left-off/pull/48) merged as `cf6dc59310820cc675fe1d8576cdb19cc4c65443` after all five [PR quality jobs](https://github.com/AdamAbuToamy/where-i-left-off/actions/runs/40961001047) passed: browser, rules, authentication recovery, dependency audit and unit/worker checks. The matched production build was deployed to Firebase Hosting only. Policy disclosures were updated in English, Arabic and Hebrew.

Production read-only HTTP verification matched the source fingerprint and exact panel bytes, confirmed cloud recognition/consent/locales in the published interface, checked the cloud privacy disclosure, and confirmed the panel no longer references local speech inference/install workers. [Machine-readable evidence](2026-10-29-session-cloud-dictation-production.json). Verification uploaded no audio and wrote no production account content. Real-device recognition quality remains unverified. Automatic main quality/hosting reruns are distinct and were not represented as completed for this publication evidence.

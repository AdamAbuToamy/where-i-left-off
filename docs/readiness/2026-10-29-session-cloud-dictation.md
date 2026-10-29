# Browser-provided cloud dictation — 2026-10-29

## Provider research and decision

Reviewed the public GitHub API catalog and official provider documentation. [Groq speech](https://console.groq.com/docs/speech-to-text) uses API keys and has [quotas](https://console.groq.com/docs/rate-limits). Puter's tutorial advertises unlimited transcription, but its [quota documentation](https://docs.puter.com/rate-limits-and-quotas/) and User-Pays model do not establish unlimited free end-user usage. Pollinations' live audio catalog exposes priced transcription models; it is not an unlimited free service. No leaked/shared personal API key, key rotation, private endpoint extraction or account/rate-limit bypass was used.

The shipped route uses the official [SpeechRecognition browser API](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition). It needs no WILO provider key, model download, additional service account or backend deployment. Chrome can use a server-based recognition engine. The application explicitly requests cloud processing when the property exists. It cannot pin or claim to choose the browser vendor's underlying model, nor promise superior recognition quality or unlimited service. It requests Palestinian Arabic, Hebrew and English locales.

## Implementation

An application controller receives an injected recognition port; the concrete browser adapter owns vendor events and globals. Recording is bounded to 24 seconds after native capture starts; startup and finalization have deadlines. Interim results replace previous hypotheses, phrases are retained across bounded automatic restarts, and only an explicit stop produces a reviewable text draft. Network/service failures are labeled rather than treated as a successful complete recording. Any available partial text remains an unapproved draft. Cancellation/session disposal removes callbacks and ignores stale events.

Audio consent is explicit before the first start and stored per signed-in UID. No engine starts on page/session open or merely enabling consent. Text saving remains explicit, using existing session domain validation, account isolation and revision checks; note plus transcript are one session proposal. A card next step uses the existing revision-checked callback. No audio is sent through WILO's backend or Pollinations. Browser/vendor retention behavior is outside WILO's control. The browser API does not expose a reusable raw recording; a failed recognition can require recording again.

## Verification and limitations

- Full application suite passed 1,220 tests before the final two adapter contract tests; subsequent focused controller/adapter checks are recorded with final publication evidence.
- Native Windows Chrome synthetic-fixture probes established API availability/event completion but did **not** establish correct transcription: the Arabic probe returned different words and the English probe returned no transcript. Fake audio support in the native recognition path was not established. These probes are not reported as successful accuracy evidence.
- Physical-microphone Arabic/Palestinian/Hebrew/English accuracy and vendor behavior require real-device verification. No accuracy percentage, guaranteed provider model or unlimited-service claim is made.
- Legacy local-model audio journey is explicitly skipped for this release, not repurposed as cloud evidence. Historical local-model reports remain valid only for their prior releases.
- Firefox/other unsupported browsers show a clear unsupported message; manual notes/checklist remain usable. Cloud availability, browser permission and network reliability can fail.

No Firestore rule/schema/backend changes. Old local weights are preserved, not automatically downloaded or removed. Frontend rollback to `1e18fe3` restores the local-message experience with its existing cache. Production and final CI results are recorded after completion.

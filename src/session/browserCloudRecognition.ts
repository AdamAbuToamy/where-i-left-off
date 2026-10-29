import type { Language } from "../translations";
import type {
  CloudRecognitionEvents,
  CloudRecognitionPort,
} from "./cloudSpeechController";
type Result = {
  isFinal: boolean;
  [index: number]: { transcript: string };
  length: number;
};
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  processLocally?: boolean;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onresult: ((event: { results: ArrayLike<Result> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
function constructor() {
  const browser = window as typeof window & {
    SpeechRecognition?: new () => Recognition;
    webkitSpeechRecognition?: new () => Recognition;
  };
  return browser.SpeechRecognition || browser.webkitSpeechRecognition;
}
export function cloudRecognitionSupported() {
  return !!constructor();
}
/** Only the browser's official recognition API; no extracted/shared vendor keys. */
export class BrowserCloudRecognition implements CloudRecognitionPort {
  private readonly language: Language;
  private voice: Recognition | null = null;
  constructor(language: Language) {
    this.language = language;
  }
  start(events: CloudRecognitionEvents) {
    const Recognition = constructor();
    if (!Recognition || !globalThis.isSecureContext)
      throw new Error("speech-cloud-unsupported");
    const voice = new Recognition();
    this.voice = voice;
    voice.lang = { ar: "ar-PS", he: "he-IL", en: "en-US" }[this.language];
    voice.continuous = true;
    voice.interimResults = true;
    if ("processLocally" in voice) voice.processLocally = false;
    voice.onstart = events.started;
    voice.onend = events.ended;
    voice.onerror = (event) => events.failed(event.error);
    voice.onresult = (event) =>
      events.result(
        Array.from(event.results, (result) => result[0]?.transcript || "").join(
          " ",
        ),
      );
    voice.start();
  }
  stop() {
    this.voice?.stop();
  }
  abort() {
    const voice = this.voice;
    this.voice = null;
    if (voice) {
      voice.onstart = voice.onend = voice.onresult = voice.onerror = null;
      try {
        voice.abort();
      } catch {
        /* Already ended. */
      }
    }
  }
}

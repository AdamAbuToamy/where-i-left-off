/// <reference lib="webworker" />
import { SESSION_SPEECH_FILES } from "./speechModel";
const host = self as unknown as DedicatedWorkerGlobalScope & {
  wiloSpeechInstaller: {
    foreground: (
      files: typeof SESSION_SPEECH_FILES,
      progress: (stage: string, loaded: number) => void,
    ) => Promise<void>;
  };
};
host.onmessage = async () => {
  try {
    await import(
      /* @vite-ignore */ new URL(
        "/speech-install-core.js",
        host.location.origin,
      ).href
    );
    await host.wiloSpeechInstaller.foreground(
      SESSION_SPEECH_FILES,
      (stage, loaded) => host.postMessage({ type: "progress", stage, loaded }),
    );
    host.postMessage({ type: "ready" });
  } catch {
    host.postMessage({ type: "error" });
  }
};

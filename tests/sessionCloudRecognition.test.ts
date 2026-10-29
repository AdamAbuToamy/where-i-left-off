import { it, expect, vi, afterEach } from "vitest";
import {
  BrowserCloudRecognition,
  cloudRecognitionSupported,
} from "../src/session/browserCloudRecognition";
afterEach(() => vi.unstubAllGlobals());
it("uses Palestinian Arabic with the browser cloud engine and releases callbacks on abort", () => {
  const result = vi.fn();
  const instances: {
    lang: string;
    processLocally: boolean;
    onresult: (event: unknown) => void;
    onend: unknown;
    abort: ReturnType<typeof vi.fn>;
  }[] = [];
  class Voice {
    lang = "";
    continuous = false;
    interimResults = false;
    processLocally = true;
    onstart = null;
    onend = null;
    onerror = null;
    onresult = () => {};
    start = vi.fn();
    stop = vi.fn();
    abort = vi.fn();
    constructor() {
      instances.push(this);
    }
  }
  vi.stubGlobal("window", { SpeechRecognition: Voice });
  vi.stubGlobal("isSecureContext", true);
  const adapter = new BrowserCloudRecognition("ar");
  expect(cloudRecognitionSupported()).toBe(true);
  adapter.start({ started: vi.fn(), ended: vi.fn(), failed: vi.fn(), result });
  const instance = instances[0];
  expect(instance.lang).toBe("ar-PS");
  expect(instance.processLocally).toBe(false);
  instance.onresult({
    results: [[{ transcript: "أول جملة" }], [{ transcript: "ثاني جملة" }]],
  });
  expect(result).toHaveBeenCalledWith("أول جملة ثاني جملة");
  adapter.abort();
  expect(instance.abort).toHaveBeenCalledOnce();
  expect(instance.onend).toBeNull();
});
it("reports unsupported browsers without starting downloads or external scripts", () => {
  vi.stubGlobal("window", {});
  vi.stubGlobal("isSecureContext", true);
  expect(cloudRecognitionSupported()).toBe(false);
  expect(() =>
    new BrowserCloudRecognition("ar").start({
      started: vi.fn(),
      ended: vi.fn(),
      failed: vi.fn(),
      result: vi.fn(),
    }),
  ).toThrow("speech-cloud-unsupported");
});

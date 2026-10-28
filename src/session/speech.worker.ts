/// <reference lib="webworker" />
import {
  env,
  AutoTokenizer,
  AutoProcessor,
  WhisperForConditionalGeneration,
  AutomaticSpeechRecognitionPipeline,
  WhisperTextStreamer,
  WhisperTokenizer,
} from "@huggingface/transformers";

import { SESSION_SPEECH_MODEL } from "./speechModel";
const worker = self as unknown as DedicatedWorkerGlobalScope;
let transcriber: AutomaticSpeechRecognitionPipeline | null = null,
  language = "ar",
  busy = false;
// Pin registry discovery requests as well as model construction to the same release.
env.remotePathTemplate = `{model}/resolve/${SESSION_SPEECH_MODEL.revision}/`;
env.allowLocalModels = false;
env.useBrowserCache = true;
if (env.backends.onnx.wasm) env.backends.onnx.wasm.numThreads = 1;
worker.onmessage = async (event: MessageEvent) => {
  const request = event.data;
  try {
    if (request.type === "load") {
      language = request.language;
      // Explicit public components avoid pipeline auto-discovery's unpinned metadata requests.
      const modelId = SESSION_SPEECH_MODEL.id;
      const options = {
        revision: SESSION_SPEECH_MODEL.revision,
        device: "wasm" as const,
        dtype: "q8" as const,
        progress_callback: (
          value: import("@huggingface/transformers").ProgressInfo,
        ) => {
          if (value.status === "progress")
            worker.postMessage({
              type: "progress",
              requestId: request.requestId,
              file: value.file,
              loaded: value.loaded,
              total: value.total,
            });
        },
      };
      const [model, tokenizer, processor] = await Promise.all([
        WhisperForConditionalGeneration.from_pretrained(modelId, options),
        AutoTokenizer.from_pretrained(modelId, options),
        AutoProcessor.from_pretrained(modelId, options),
      ]);
      transcriber = new AutomaticSpeechRecognitionPipeline({
        task: "automatic-speech-recognition",
        model,
        tokenizer,
        processor,
      });
      worker.postMessage({ type: "loaded", requestId: request.requestId });
    } else if (request.type === "transcribe") {
      if (!transcriber || busy) throw new Error("speech-not-ready");
      busy = true;
      const audio = request.audio as Float32Array;
      let text = "";
      try {
        if (!(transcriber.tokenizer instanceof WhisperTokenizer))
          throw new Error("speech-model-incompatible");
        const streamer = new WhisperTextStreamer(transcriber.tokenizer, {
          skip_prompt: true,
          callback_function: (chunk) => {
            text += chunk;
            worker.postMessage({
              type: "partial",
              requestId: request.requestId,
              text,
            });
          },
        });
        const output = await transcriber(audio, {
          language,
          task: "transcribe",
          max_new_tokens: 192,
          return_timestamps: false,
          chunk_length_s: 15,
          stride_length_s: 2,
          streamer,
        });
        const result = Array.isArray(output) ? output[0] : output;
        if (typeof result.text !== "string" || result.text.length > 1000)
          throw new Error("speech-output-limit");
        worker.postMessage({
          type: "final",
          requestId: request.requestId,
          text: result.text.trim(),
        });
      } finally {
        audio.fill(0);
        busy = false;
      }
    }
  } catch (error) {
    worker.postMessage({
      type: "error",
      requestId: request.requestId,
      code:
        request.type === "load" ? "speech-model-load" : "speech-transcription",
      detail: error instanceof Error ? error.name : "Error",
    });
  }
};

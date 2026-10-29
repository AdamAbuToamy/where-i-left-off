/// <reference lib="webworker" />
import {
  env,
  AutoTokenizer,
  AutoConfig,
  AutoProcessor,
  WhisperForConditionalGeneration,
  AutomaticSpeechRecognitionPipeline,
  WhisperTextStreamer,
  WhisperTokenizer,
} from "@huggingface/transformers";

import { createSpeechAssetCache } from "./speechAssetCache";
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
      const assetCache = await createSpeechAssetCache();
      env.useCustomCache = true;
      env.customCache = assetCache;
      // Explicit public components avoid pipeline auto-discovery's unpinned metadata requests.
      const modelId = SESSION_SPEECH_MODEL.id;
      const config = await AutoConfig.from_pretrained(modelId, {
        revision: SESSION_SPEECH_MODEL.revision,
      });
      config["transformers.js_config"] = {
        ...config["transformers.js_config"],
        use_external_data_format: false,
      };
      const options = {
        config,
        revision: SESSION_SPEECH_MODEL.revision,
        device: SESSION_SPEECH_MODEL.device,
        dtype: SESSION_SPEECH_MODEL.dtype,
        // Quantized weights are self-contained; never fetch the FP32 external tensor file.
        use_external_data_format: false,
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
      // Never claim a one-time installation if the browser could not retain either weight.
      for (const file of [
        "encoder_model_q4f16.onnx",
        "decoder_model_merged_q4f16.onnx",
      ]) {
        const url = `https://huggingface.co/${modelId}/resolve/${SESSION_SPEECH_MODEL.revision}/onnx/${file}`;
        if (!(await assetCache.match(url))) throw new Error("speech-cache");
      }
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
          max_new_tokens: 448,
          return_timestamps: false,
          chunk_length_s: 30,
          stride_length_s: 3,
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
        error instanceof Error && error.message === "speech-cache"
          ? "speech-cache"
          : request.type === "load"
            ? "speech-model-load"
            : "speech-transcription",
      detail: error instanceof Error ? error.name : "Error",
    });
  }
};

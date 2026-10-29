import assets from "./speechAssets.json" with { type: "json" };
/** Immutable public assets. Shared by the shipped worker and opt-in audio checks. */
export const SESSION_SPEECH_MODEL = {
  id: "onnx-community/whisper-large-v3-turbo",
  revision: "360ebcde2559d60bb474678be3c1de9ef347d01a",
  label: "Whisper Large V3 Turbo",
  downloadMegabytes: 565,
  device: "webgpu",
  dtype: { encoder_model: "q4f16", decoder_model_merged: "q4f16" },
  requiresWebGPU: true,
} as const;

/** Verified 16 MiB ranges keep browser-owned downloads below large-response limits. */
if (assets.revision !== SESSION_SPEECH_MODEL.revision)
  throw new Error("speech-assets-version");
export const SESSION_SPEECH_FILES = assets.weights.map((asset) => {
  const url = `https://huggingface.co/${SESSION_SPEECH_MODEL.id}/resolve/${SESSION_SPEECH_MODEL.revision}/onnx/${asset.file}`;
  return {
    ...asset,
    url,
    parts: asset.chunks.map((sha256, index) => {
      const start = index * assets.partSize,
        end = Math.min(asset.size, start + assets.partSize) - 1;
      const partUrl = new URL(url);
      partUrl.searchParams.set("wilo-part", String(start));
      return {
        url: partUrl.href,
        start,
        end,
        size: end - start + 1,
        sha256,
        range: `bytes=${start}-${end}`,
      };
    }),
  };
});
export const SESSION_SPEECH_DOWNLOAD_ID =
  "wilo-speech-parts-v1-" + SESSION_SPEECH_MODEL.revision;

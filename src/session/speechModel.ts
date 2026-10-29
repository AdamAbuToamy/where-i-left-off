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

import { InteractionAudio } from "./interactionAudio";
let prepared: InteractionAudio | null = null;
let expiry: ReturnType<typeof setTimeout> | undefined;
export function cancelEntryAudio() {
  if (expiry) clearTimeout(expiry);
  expiry = undefined;
  prepared?.dispose();
  prepared = null;
}
/** Unlock silently inside the actual sign-in gesture; never delays the provider popup. */
export function armEntryAudio() {
  cancelEntryAudio();
  const audio = new InteractionAudio();
  prepared = audio;
  void audio.unlock().then((ok) => {
    if (!ok && prepared === audio) cancelEntryAudio();
  });
  expiry = setTimeout(cancelEntryAudio, 120000);
}
export function takeEntryAudio() {
  const audio = prepared;
  prepared = null;
  if (expiry) clearTimeout(expiry);
  expiry = undefined;
  return audio || new InteractionAudio();
}

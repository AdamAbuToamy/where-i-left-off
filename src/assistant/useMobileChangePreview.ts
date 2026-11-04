import { usePhoneSurface } from "../components/usePhoneSurface";
import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
type Reveal = (onVisible?: () => void) => void;
/** Phone presentation only. A caller supplies the existing confirmed-change reveal. */
export function useMobileChangePreview(
  mobile: boolean,
  open: boolean,
  input: RefObject<HTMLTextAreaElement | null>,
  panel: RefObject<HTMLElement | null>,
) {
  const [peeking, setPeeking] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    generation = useRef(0);
  function cancel() {
    generation.current++;
    clearTimeout(timer.current);
  }
  function returnToChat() {
    cancel();
    setPeeking(false);
    panel.current
      ?.querySelector<HTMLButtonElement>(".assistant-close")
      ?.focus({ preventScroll: true });
  }
  function beforeOpen() {
    cancel();
    setPeeking(false);
  }
  useEffect(
    () => () => {
      generation.current++;
      clearTimeout(timer.current);
    },
    [],
  );
  usePhoneSurface(panel, mobile && open && !peeking);
  function show(reveal: Reveal) {
    if (!open) {
      reveal();
      return;
    }
    cancel();
    const current = generation.current;
    input.current?.blur();
    setPeeking(true);
    // A slow/missing DOM target cannot leave the conversation permanently minimized.
    timer.current = setTimeout(() => {
      if (generation.current === current) returnToChat();
    }, 10000);
    reveal(() => {
      if (generation.current !== current) return;
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        if (generation.current === current) returnToChat();
      }, 2400);
    });
  }
  return { peeking, show, returnToChat, beforeOpen, beforeClose: cancel };
}

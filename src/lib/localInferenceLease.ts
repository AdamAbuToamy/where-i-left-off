/** Browser resource boundary: one large local inference runtime per origin/tab. */
export type LocalInferenceKind = "text" | "speech";
let held: LocalInferenceKind | null = null;
export async function acquireLocalInference(
  kind: LocalInferenceKind,
): Promise<() => void> {
  if (held) throw new Error("local-inference-busy");
  held = kind;
  let unlock: (() => void) | undefined;
  try {
    if (typeof navigator !== "undefined" && navigator.locks) {
      await new Promise<void>((resolve, reject) => {
        void navigator.locks
          .request(
            "wilo-local-inference",
            { ifAvailable: true },
            async (lock) => {
              if (!lock) {
                reject(new Error("local-inference-busy"));
                return;
              }
              await new Promise<void>((released) => {
                unlock = released;
                resolve();
              });
            },
          )
          .catch(reject);
      });
    }
  } catch (error) {
    held = null;
    throw error;
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    held = null;
    unlock?.();
  };
}

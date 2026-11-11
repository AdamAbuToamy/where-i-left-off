export const colorModes = ["system", "light", "dark"] as const;
export type ColorMode = (typeof colorModes)[number];
export function readColorMode(uid = ""): ColorMode {
  try {
    const value = localStorage.getItem(
      uid ? `site-color-mode:${uid}` : "site-color-mode",
    );
    return colorModes.includes(value as ColorMode)
      ? (value as ColorMode)
      : "system";
  } catch {
    return "system";
  }
}
export function applyColorMode(mode: ColorMode) {
  const dark =
    mode === "dark" ||
    (mode === "system" &&
      typeof matchMedia === "function" &&
      matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.colorScheme = dark ? "dark" : "light";
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
  document
    .querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    ?.setAttribute("content", dark ? "#171b22" : "#aa4c2a");
}
export function saveColorMode(uid: string, mode: ColorMode) {
  try {
    localStorage.setItem(`site-color-mode:${uid}`, mode);
    localStorage.setItem("site-color-mode", mode);
  } catch {
    /* Current session still works. */
  }
  applyColorMode(mode);
  window.dispatchEvent(new Event("appearance-changed"));
}
/** One listener per app shell; OS changes only affect system mode. */
export function observeColorMode(uid = "") {
  const changed = () => applyColorMode(readColorMode(uid));
  changed();
  const query =
    typeof matchMedia === "function"
      ? matchMedia("(prefers-color-scheme: dark)")
      : null;
  query?.addEventListener?.("change", changed);
  window.addEventListener("storage", changed);
  window.addEventListener("appearance-changed", changed);
  return () => {
    query?.removeEventListener?.("change", changed);
    window.removeEventListener("storage", changed);
    window.removeEventListener("appearance-changed", changed);
  };
}

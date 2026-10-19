export const themes = ['original', 'ocean', 'olive', 'violet', 'cobalt', 'emerald', 'sunset', 'rose'] as const
export type SiteTheme = typeof themes[number]
export const backgrounds = ['dots', 'paper', 'grid', 'linen', 'mist', 'plain'] as const
export type SiteBackground = typeof backgrounds[number]

function readChoice<T extends string>(key: string, choices: readonly T[], fallback: T): T {
  try {
    const stored = localStorage.getItem(key)
    return choices.includes(stored as T) ? stored as T : fallback
  } catch { return fallback }
}
export function readTheme(uid: string): SiteTheme {
  return readChoice(`site-theme:${uid}`, themes, 'original')
}
export function readBackground(uid: string): SiteBackground {
  return readChoice(`site-background:${uid}`, backgrounds, 'dots')
}
export function applyTheme(uid?: string) {
  document.documentElement.dataset.theme = uid ? readTheme(uid) : 'original'
  document.documentElement.dataset.background = uid ? readBackground(uid) : 'dots'
}
export function saveTheme(uid: string, theme: SiteTheme) {
  try { localStorage.setItem(`site-theme:${uid}`, theme) } catch { /* Session appearance still works. */ }
  document.documentElement.dataset.theme = theme
}
export function saveBackground(uid: string, background: SiteBackground) {
  try { localStorage.setItem(`site-background:${uid}`, background) } catch { /* Session appearance still works. */ }
  document.documentElement.dataset.background = background
}

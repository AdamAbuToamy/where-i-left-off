export const themes = ['original', 'ocean', 'olive', 'violet', 'cobalt', 'emerald', 'sunset', 'rose'] as const
export type SiteTheme = typeof themes[number]
export function readTheme(uid: string): SiteTheme {
 try { const stored = localStorage.getItem(`site-theme:${uid}`); return themes.includes(stored as SiteTheme) ? stored as SiteTheme : 'original' } catch { return 'original' }
}
export function applyTheme(uid?: string) { document.documentElement.dataset.theme = uid ? readTheme(uid) : 'original' }
export function saveTheme(uid: string, theme: SiteTheme) {
 try { localStorage.setItem(`site-theme:${uid}`, theme) } catch { /* Session appearance still works. */ }
 document.documentElement.dataset.theme = theme
}

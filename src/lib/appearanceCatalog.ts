export const themes = ['original', 'ocean', 'olive', 'violet', 'cobalt', 'emerald', 'sunset', 'rose'] as const
export type SiteTheme = typeof themes[number]
export const backgrounds = ['dots', 'paper', 'grid', 'linen', 'mist', 'plain'] as const
export type SiteBackground = typeof backgrounds[number]

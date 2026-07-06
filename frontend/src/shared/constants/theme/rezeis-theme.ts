/**
 * Rezeis fork theming extension.
 *
 * `rezeisTheme` is an extra block on the subpage config (NOT part of the
 * upstream strict schema) that the rezeis-admin panel controls. It lets the
 * operator drive the subpage look without a redeploy:
 *   - primaryColor    → Mantine primary color (buttons, accents)
 *   - backgroundColor  → page background (CSS var --rezeis-bg)
 *   - accentColor      → aurora / glass accent tint (CSS var --rezeis-accent)
 *
 * Values are validated (allow-listed Mantine color / hex only) before use, so
 * operator input can never inject arbitrary CSS.
 */
export interface RezeisTheme {
    accentColor?: string
    backgroundColor?: string
    primaryColor?: string
}

const MANTINE_COLORS = new Set([
    'blue',
    'cyan',
    'dark',
    'grape',
    'gray',
    'green',
    'indigo',
    'lime',
    'orange',
    'pink',
    'red',
    'teal',
    'violet',
    'yellow'
])

const HEX = /^#[0-9a-fA-F]{3,8}$/

const DEFAULT_BG = '#0b0f17'
const DEFAULT_ACCENT = '#22d3ee'

export function resolvePrimaryColor(theme?: RezeisTheme): string | undefined {
    if (theme?.primaryColor && MANTINE_COLORS.has(theme.primaryColor)) {
        return theme.primaryColor
    }
    return undefined
}

/** Set the CSS variables consumed by global.css. Falls back to defaults. */
export function applyRezeisCssVars(theme?: RezeisTheme): void {
    if (typeof document === 'undefined') return

    const root = document.documentElement
    const bg =
        theme?.backgroundColor && HEX.test(theme.backgroundColor)
            ? theme.backgroundColor
            : DEFAULT_BG
    const accent =
        theme?.accentColor && HEX.test(theme.accentColor) ? theme.accentColor : DEFAULT_ACCENT

    root.style.setProperty('--rezeis-bg', bg)
    root.style.setProperty('--rezeis-accent', accent)
}

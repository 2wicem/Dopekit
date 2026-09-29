export const THEME_STORAGE_KEY = 'dopekit-theme'
export const THEMES = ['dark', 'light']

export function getStoredTheme() {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    if (THEMES.includes(stored)) {
      return stored
    }
  } catch {
    // Private mode / blocked storage
  }
  return 'dark'
}

export function applyTheme(theme) {
  const root = document.documentElement
  root.setAttribute('data-theme', theme)
  root.setAttribute('data-bs-theme', theme)
  root.style.colorScheme = theme

  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) {
    meta.setAttribute('content', theme === 'light' ? '#fce4ec' : '#6d3557')
  }
}

/* eslint-disable react/prop-types */
import { createContext, useCallback, useEffect, useMemo, useState } from 'react'
import { THEME_STORAGE_KEY, applyTheme, getStoredTheme } from './theme'

export const ThemeContext = createContext(null)

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    const initial = getStoredTheme()
    applyTheme(initial)
    return initial
  })

  useEffect(() => {
    applyTheme(theme)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch {
      // Ignore persistence errors
    }
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
  }, [])

  const value = useMemo(
    () => ({
      theme,
      isDark: theme === 'dark',
      setTheme,
      toggleTheme,
    }),
    [theme, toggleTheme]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

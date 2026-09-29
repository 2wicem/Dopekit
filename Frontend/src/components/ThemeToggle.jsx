/* eslint-disable react/prop-types */
import { useTheme } from '../context/useTheme'
import './css/ThemeToggle.css'

const ThemeToggle = ({ variant = 'switch' }) => {
  const { theme, toggleTheme, isDark } = useTheme()
  const label = isDark ? 'Switch to light mode' : 'Switch to dark mode'

  if (variant === 'icon') {
    return (
      <button
        type="button"
        className={`theme-toggle theme-toggle--icon ${isDark ? 'is-dark' : 'is-light'}`}
        onClick={toggleTheme}
        aria-label={label}
        title={label}
      >
        <i className={isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon'} aria-hidden="true" />
      </button>
    )
  }

  return (
    <button
      type="button"
      className={`theme-toggle theme-toggle--${variant} ${isDark ? 'is-dark' : 'is-light'}`}
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      aria-pressed={theme === 'light'}
    >
      <span className="theme-toggle-track" aria-hidden="true">
        <i className="fa-solid fa-sun" />
        <span className="theme-toggle-thumb" />
        <i className="fa-solid fa-moon" />
      </span>
    </button>
  )
}

export default ThemeToggle

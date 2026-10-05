import { useState } from 'react'
import { Sun, Moon } from 'lucide-react'

const current = () => document.documentElement.getAttribute('data-theme') || 'dark'

export default function ThemeToggle({ className = 'k-btn', showLabel = true }) {
  const [theme, setTheme] = useState(current)

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', next)
    try { localStorage.setItem('theme', next) } catch {}
    setTheme(next)
  }

  const label = theme === 'dark' ? 'Light mode' : 'Dark mode'
  return (
    <button type="button" className={className} onClick={toggle} aria-label={`Switch to ${label.toLowerCase()}`} title={label}>
      {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
      {showLabel && <span className="label">{theme === 'dark' ? 'Light' : 'Dark'}</span>}
    </button>
  )
}

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

type Theme = 'light' | 'dark'
const key = 'supporthub-theme'
const ThemeContext = createContext<{ theme: Theme; toggle: () => void } | null>(null)

function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem(key)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    // Storage can be disabled in private contexts.
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState(initialTheme)
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem(key, theme)
    } catch {
      // Theme remains usable for this page even without persistence.
    }
  }, [theme])
  return (
    <ThemeContext.Provider
      value={{ theme, toggle: () => setTheme((value) => (value === 'light' ? 'dark' : 'light')) }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('ThemeProvider is required')
  return context
}

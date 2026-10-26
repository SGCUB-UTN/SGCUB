import { useCallback, useEffect, useMemo, useState } from 'react'
import { MantineProvider } from '@mantine/core'
import { ThemeContext } from './themeContext'

const STORAGE_KEY = 'sgcub-theme'

function getInitialTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'dark' || saved === 'light') return saved
  } catch {
    // ignore storage errors
  }
  return 'light'
}

export default function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme)

  useEffect(() => {
    const isDark = theme === 'dark'
    document.documentElement.classList.toggle('dark', isDark)
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // ignore storage errors
    }
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
  }, [])

  const value = useMemo(
    () => ({ theme, isDark: theme === 'dark', toggleTheme, setTheme }),
    [theme, toggleTheme],
  )

  return (
    <ThemeContext.Provider value={value}>
      <MantineProvider theme={{ colorScheme: theme }} withGlobalStyles withNormalizeCSS>
        {children}
      </MantineProvider>
    </ThemeContext.Provider>
  )
}


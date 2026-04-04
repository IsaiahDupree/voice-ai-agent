'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

// F1446: Configurable accent color themes
type AccentColor = 'blue' | 'purple' | 'green' | 'orange' | 'pink' | 'red'

interface ThemeContextType {
  theme: Theme
  accentColor: AccentColor
  toggleTheme: () => void
  setAccentColor: (color: AccentColor) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

// F1446: Color theme CSS variables mapping
const accentColorVariables: Record<AccentColor, Record<string, string>> = {
  blue: {
    '--color-primary': '59 130 246', // blue-500
    '--color-primary-dark': '37 99 235', // blue-600
    '--color-primary-light': '96 165 250', // blue-400
  },
  purple: {
    '--color-primary': '168 85 247', // purple-500
    '--color-primary-dark': '147 51 234', // purple-600
    '--color-primary-light': '192 132 252', // purple-400
  },
  green: {
    '--color-primary': '34 197 94', // green-500
    '--color-primary-dark': '22 163 74', // green-600
    '--color-primary-light': '74 222 128', // green-400
  },
  orange: {
    '--color-primary': '249 115 22', // orange-500
    '--color-primary-dark': '234 88 12', // orange-600
    '--color-primary-light': '251 146 60', // orange-400
  },
  pink: {
    '--color-primary': '236 72 153', // pink-500
    '--color-primary-dark': '219 39 119', // pink-600
    '--color-primary-light': '244 114 182', // pink-400
  },
  red: {
    '--color-primary': '239 68 68', // red-500
    '--color-primary-dark': '220 38 38', // red-600
    '--color-primary-light': '248 113 113', // red-400
  },
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light')
  const [accentColor, setAccentColorState] = useState<AccentColor>('blue')
  const [mounted, setMounted] = useState(false)

  // F0732: Load theme from localStorage on mount
  // F1446: Load accent color from localStorage
  useEffect(() => {
    setMounted(true)
    const savedTheme = localStorage.getItem('theme') as Theme | null
    const savedAccentColor = localStorage.getItem('accentColor') as AccentColor | null
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches

    const initialTheme = savedTheme || (prefersDark ? 'dark' : 'light')
    const initialAccentColor = savedAccentColor || 'blue'

    setTheme(initialTheme)
    setAccentColorState(initialAccentColor)

    // Apply theme class to html element
    if (initialTheme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }

    // Apply accent color CSS variables
    applyAccentColor(initialAccentColor)
  }, [])

  const applyAccentColor = (color: AccentColor) => {
    const variables = accentColorVariables[color]
    Object.entries(variables).forEach(([key, value]) => {
      document.documentElement.style.setProperty(key, value)
    })
  }

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)

    // Persist to localStorage
    localStorage.setItem('theme', newTheme)

    // Apply to document
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  const setAccentColor = (color: AccentColor) => {
    setAccentColorState(color)
    localStorage.setItem('accentColor', color)
    applyAccentColor(color)
  }

  // Prevent flash of unstyled content
  if (!mounted) {
    return <>{children}</>
  }

  return (
    <ThemeContext.Provider value={{ theme, accentColor, toggleTheme, setAccentColor }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}

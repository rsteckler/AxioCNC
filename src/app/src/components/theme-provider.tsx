import { createContext, useContext, useEffect, useState } from "react"

type Theme = "dark" | "light" | "system"
type AccentColor = "orange" | "blue" | "green" | "purple" | "red" | "zinc"

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  defaultAccent?: AccentColor
  storageKey?: string
}

type ThemeProviderState = {
  theme: Theme
  accentColor: AccentColor
  setTheme: (theme: Theme) => void
  setAccentColor: (color: AccentColor) => void
}

const initialState: ThemeProviderState = {
  theme: "system",
  accentColor: "orange",
  setTheme: () => null,
  setAccentColor: () => null,
}

const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

// CSS variable values for each accent color
const ACCENT_CSS_VALUES: Record<AccentColor, { light: Record<string, string>; dark: Record<string, string> }> = {
  orange: {
    light: {
      '--primary': '24 95% 53%',
      '--primary-foreground': '0 0% 100%',
      '--accent': '24 100% 97%',
      '--accent-foreground': '24 95% 30%',
      '--ring': '24 95% 53%',
    },
    dark: {
      '--primary': '24 95% 58%',
      '--primary-foreground': '0 0% 0%',
      '--accent': '24 50% 15%',
      '--accent-foreground': '24 95% 70%',
      '--ring': '24 95% 58%',
    },
  },
  blue: {
    light: {
      '--primary': '217 91% 60%',
      '--primary-foreground': '0 0% 100%',
      '--accent': '217 100% 97%',
      '--accent-foreground': '217 91% 30%',
      '--ring': '217 91% 60%',
    },
    dark: {
      '--primary': '217 91% 65%',
      '--primary-foreground': '0 0% 0%',
      '--accent': '217 50% 15%',
      '--accent-foreground': '217 91% 75%',
      '--ring': '217 91% 65%',
    },
  },
  green: {
    light: {
      '--primary': '142 76% 36%',
      '--primary-foreground': '0 0% 100%',
      '--accent': '142 100% 97%',
      '--accent-foreground': '142 76% 25%',
      '--ring': '142 76% 36%',
    },
    dark: {
      '--primary': '142 70% 45%',
      '--primary-foreground': '0 0% 0%',
      '--accent': '142 50% 15%',
      '--accent-foreground': '142 70% 65%',
      '--ring': '142 70% 45%',
    },
  },
  purple: {
    light: {
      '--primary': '262 83% 58%',
      '--primary-foreground': '0 0% 100%',
      '--accent': '262 100% 97%',
      '--accent-foreground': '262 83% 35%',
      '--ring': '262 83% 58%',
    },
    dark: {
      '--primary': '262 83% 65%',
      '--primary-foreground': '0 0% 0%',
      '--accent': '262 50% 18%',
      '--accent-foreground': '262 83% 75%',
      '--ring': '262 83% 65%',
    },
  },
  red: {
    light: {
      '--primary': '0 84% 60%',
      '--primary-foreground': '0 0% 100%',
      '--accent': '0 100% 97%',
      '--accent-foreground': '0 84% 35%',
      '--ring': '0 84% 60%',
    },
    dark: {
      '--primary': '0 84% 65%',
      '--primary-foreground': '0 0% 0%',
      '--accent': '0 50% 18%',
      '--accent-foreground': '0 84% 75%',
      '--ring': '0 84% 65%',
    },
  },
  zinc: {
    light: {
      '--primary': '240 5% 26%',
      '--primary-foreground': '0 0% 100%',
      '--accent': '240 5% 96%',
      '--accent-foreground': '240 5% 15%',
      '--ring': '240 5% 26%',
    },
    dark: {
      '--primary': '240 5% 84%',
      '--primary-foreground': '0 0% 0%',
      '--accent': '240 5% 20%',
      '--accent-foreground': '240 5% 90%',
      '--ring': '240 5% 84%',
    },
  },
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
  defaultAccent = "orange",
  storageKey = "cncjs-ui-theme",
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
  )
  const [accentColor, setAccentColor] = useState<AccentColor>(
    () => (localStorage.getItem(`${storageKey}-accent`) as AccentColor) || defaultAccent
  )

  // Apply theme class
  useEffect(() => {
    const root = window.document.documentElement

    root.classList.remove("light", "dark")

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light"

      root.classList.add(systemTheme)
    } else {
      root.classList.add(theme)
    }
  }, [theme])

  // Apply accent color CSS variables
  useEffect(() => {
    const root = window.document.documentElement
    const isDark = root.classList.contains('dark')
    const colorMode = isDark ? 'dark' : 'light'
    const cssVars = ACCENT_CSS_VALUES[accentColor][colorMode]

    Object.entries(cssVars).forEach(([key, value]) => {
      root.style.setProperty(key, value)
    })
  }, [accentColor, theme])

  // Re-apply accent colors when theme changes (light/dark switch)
  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          const root = window.document.documentElement
          const isDark = root.classList.contains('dark')
          const colorMode = isDark ? 'dark' : 'light'
          const cssVars = ACCENT_CSS_VALUES[accentColor][colorMode]

          Object.entries(cssVars).forEach(([key, value]) => {
            root.style.setProperty(key, value)
          })
        }
      })
    })

    observer.observe(document.documentElement, { attributes: true })
    return () => observer.disconnect()
  }, [accentColor])

  const value = {
    theme,
    accentColor,
    setTheme: (theme: Theme) => {
      localStorage.setItem(storageKey, theme)
      setTheme(theme)
    },
    setAccentColor: (color: AccentColor) => {
      localStorage.setItem(`${storageKey}-accent`, color)
      setAccentColor(color)
    },
  }

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext)

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider")

  return context
}

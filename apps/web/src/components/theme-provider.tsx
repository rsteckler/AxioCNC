import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react"
import { useGetThemeQuery, useGetSettingsQuery, useSetSettingsMutation } from "@/services/api"
import type { ThemeCSSVariables } from "@/services/api"

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
  customThemeId: string | null
  setTheme: (theme: Theme) => void
  setAccentColor: (color: AccentColor) => void
  setCustomTheme: (themeId: string | null) => void
}

const initialState: ThemeProviderState = {
  theme: "system",
  accentColor: "orange",
  customThemeId: null,
  setTheme: () => null,
  setAccentColor: () => null,
  setCustomTheme: () => null,
}

const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

// CSS variable values for each accent color (used when no custom theme is active)
const ACCENT_CSS_VALUES: Record<AccentColor, { light: ThemeCSSVariables; dark: ThemeCSSVariables }> = {
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

// Apply CSS variables to the document root
const applyCSSVariables = (vars: ThemeCSSVariables) => {
  const root = window.document.documentElement
  Object.entries(vars).forEach(([key, value]) => {
    if (value) {
      root.style.setProperty(key, value)
    }
  })
}

// Clear all inline CSS variables from the root element
// This ensures custom theme variables don't persist when switching back to default
const clearInlineCSSVariables = () => {
  const root = window.document.documentElement
  root.style.cssText = ''
}


export function ThemeProvider({
  children,
  defaultTheme = "system",
  defaultAccent = "orange",
  storageKey = "axiocnc-ui-theme",
  ...props
}: ThemeProviderProps) {
  // Track if we've initialized from the settings API
  const hasInitialized = useRef(false)

  // Local state for immediate UI updates (falls back to localStorage for initial render)
  const [theme, setThemeState] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
  )
  const [accentColor, setAccentColorState] = useState<AccentColor>(
    () => (localStorage.getItem(`${storageKey}-accent`) as AccentColor) || defaultAccent
  )
  const [customThemeId, setCustomThemeIdState] = useState<string | null>(
    () => localStorage.getItem(`${storageKey}-custom`) || null
  )

  // Settings API hooks
  const { data: settings } = useGetSettingsQuery()
  const [setSettings] = useSetSettingsMutation()

  // Initialize state from settings API (once loaded)
  useEffect(() => {
    if (settings?.appearance && !hasInitialized.current) {
      hasInitialized.current = true
      
      const { theme: apiTheme, accentColor: apiAccent, customThemeId: apiCustomTheme } = settings.appearance
      
      // Update local state from API (if different from current values)
      if (apiTheme && apiTheme !== theme) {
        setThemeState(apiTheme)
        localStorage.setItem(storageKey, apiTheme)
      }
      if (apiAccent && apiAccent !== accentColor) {
        setAccentColorState(apiAccent)
        localStorage.setItem(`${storageKey}-accent`, apiAccent)
      }
      if (apiCustomTheme !== customThemeId) {
        setCustomThemeIdState(apiCustomTheme)
        if (apiCustomTheme) {
          localStorage.setItem(`${storageKey}-custom`, apiCustomTheme)
        } else {
          localStorage.removeItem(`${storageKey}-custom`)
        }
      }
    }
  }, [settings, storageKey, theme, accentColor, customThemeId])

  // Fetch custom theme data when a custom theme is selected
  const { data: customThemeData } = useGetThemeQuery(customThemeId!, {
    skip: !customThemeId,
  })

  // Apply theme class (light/dark)
  useEffect(() => {
    const root = window.document.documentElement
    root.classList.remove("light", "dark")

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      root.classList.add(systemTheme)
    } else {
      root.classList.add(theme)
    }
  }, [theme])

  // Track previous custom theme to detect when switching away from it
  const prevCustomThemeId = useRef<string | null>(customThemeId)
  
  // Apply theme CSS variables
  useEffect(() => {
    // Determine actual color mode from the DOM (after theme class is applied)
    const root = window.document.documentElement
    const colorMode = root.classList.contains('dark') ? 'dark' : 'light'

    // If we just switched FROM a custom theme TO default, clear all inline styles first
    if (prevCustomThemeId.current && !customThemeId) {
      clearInlineCSSVariables()
    }
    prevCustomThemeId.current = customThemeId

    if (customThemeId && customThemeData) {
      // Apply custom theme CSS variables
      const themeVars = customThemeData[colorMode]
      if (themeVars) {
        applyCSSVariables(themeVars)
      }
    } else {
      // Apply accent color CSS variables
      const cssVars = ACCENT_CSS_VALUES[accentColor][colorMode]
      applyCSSVariables(cssVars)
    }
  }, [theme, accentColor, customThemeId, customThemeData])

  // Re-apply CSS variables when theme mode changes (observer for class changes)
  useEffect(() => {
    const root = document.documentElement
    
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          const colorMode = root.classList.contains('dark') ? 'dark' : 'light'

          if (customThemeId && customThemeData) {
            const themeVars = customThemeData[colorMode]
            if (themeVars) {
              applyCSSVariables(themeVars)
            }
          } else {
            const cssVars = ACCENT_CSS_VALUES[accentColor][colorMode]
            applyCSSVariables(cssVars)
          }
        }
      })
    })

    observer.observe(root, { attributes: true })
    return () => observer.disconnect()
  }, [accentColor, customThemeId, customThemeData])

  const setTheme = useCallback((newTheme: Theme) => {
    // Update localStorage for immediate persistence
    localStorage.setItem(storageKey, newTheme)
    setThemeState(newTheme)
    // Save to settings API
    setSettings({ appearance: { theme: newTheme } })
  }, [storageKey, setSettings])

  const setAccentColor = useCallback((color: AccentColor) => {
    // Update localStorage for immediate persistence
    localStorage.setItem(`${storageKey}-accent`, color)
    setAccentColorState(color)
    // Save to settings API
    setSettings({ appearance: { accentColor: color } })
  }, [storageKey, setSettings])

  const setCustomTheme = useCallback((themeId: string | null) => {
    // Update localStorage for immediate persistence
    if (themeId) {
      localStorage.setItem(`${storageKey}-custom`, themeId)
    } else {
      localStorage.removeItem(`${storageKey}-custom`)
      // When clearing custom theme, clear all inline styles first, then re-apply accent color
      clearInlineCSSVariables()
      const root = document.documentElement
      const colorMode = root.classList.contains('dark') ? 'dark' : 'light'
      const cssVars = ACCENT_CSS_VALUES[accentColor][colorMode]
      applyCSSVariables(cssVars)
    }
    setCustomThemeIdState(themeId)
    // Save to settings API
    setSettings({ appearance: { customThemeId: themeId } })
  }, [storageKey, accentColor, setSettings])

  const value = {
    theme,
    accentColor,
    customThemeId,
    setTheme,
    setAccentColor,
    setCustomTheme,
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

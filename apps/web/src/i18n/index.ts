import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

// Bundled English translations (loaded immediately)
import enController from './en/controller.json'
import enGcode from './en/gcode.json'
import enResource from './en/resource.json'

// Supported languages (matching legacy frontend)
export const supportedLanguages = [
  'en',    // English (default)
  'cs',    // Czech
  'de',    // German
  'es',    // Spanish
  'fr',    // French
  'hu',    // Hungarian
  'it',    // Italian
  'ja',    // Japanese
  'nb',    // Norwegian
  'nl',    // Dutch
  'pt',    // Portuguese
  'pt-br', // Portuguese (Brazil)
  'ru',    // Russian
  'tr',    // Turkish
  'uk',    // Ukrainian
  'zh-cn', // Chinese Simplified
  'zh-tw', // Chinese Traditional
] as const

export type SupportedLanguage = typeof supportedLanguages[number]

// Lazy load translations for non-English languages
const loadTranslations = async (lng: string, ns: string): Promise<object> => {
  if (lng === 'en') {
    // English is bundled, return immediately
    switch (ns) {
      case 'controller': return enController
      case 'gcode': return enGcode
      case 'resource': return enResource
      default: return {}
    }
  }

  // Lazy load from server for other languages
  const url = `/i18n/${lng}/${ns}.json`
  try {
    const response = await fetch(url)
    if (!response.ok) {
      console.warn(`Failed to load translations for ${lng}/${ns}`)
      return {}
    }
    let text = await response.text()
    // Strip BOM so we don't reject or fail to parse JSON (e.g. zh-cn/zh-tw files)
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
    // Vite/SPA may return index.html (200) for missing paths; treat as failed load
    const trimmed = text.trimStart()
    if (trimmed.startsWith('<') || !trimmed.startsWith('{')) {
      return {}
    }
    try {
      return JSON.parse(text) as object
    } catch {
      return {}
    }
  } catch (error) {
    console.warn(`Error loading translations for ${lng}/${ns}:`, error)
    return {}
  }
}

// Custom backend for lazy loading
const lazyBackend = {
  type: 'backend' as const,
  init: () => {},
  read: (lng: string, ns: string, callback: (err: Error | null, data: object | null) => void) => {
    loadTranslations(lng, ns)
      .then(data => callback(null, data))
      .catch(err => callback(err, null))
  },
}

const NAMESPACES = ['resource', 'controller', 'gcode'] as const

/**
 * Explicitly load all namespaces for a language and add them to i18n.
 * Use this when changing language so translations load even when the lazy
 * backend's read() is not called (e.g. in Electron).
 */
export async function loadLanguageResources(lng: string): Promise<void> {
  if (lng === 'en') return
  for (const ns of NAMESPACES) {
    const data = await loadTranslations(lng, ns)
    if (data && typeof data === 'object' && Object.keys(data).length > 0) {
      i18n.addResourceBundle(lng, ns, data, true, true)
    }
  }
}

/** Promise that resolves when i18n has finished initializing. */
export const i18nReady = i18n
  .use(lazyBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    // Bundled English resources
    resources: {
      en: {
        controller: enController,
        gcode: enGcode,
        resource: enResource,
      },
    },

    fallbackLng: 'en',
    supportedLngs: supportedLanguages as unknown as string[],

    ns: ['controller', 'gcode', 'resource'],
    defaultNS: 'resource',

    interpolation: {
      escapeValue: false, // React already escapes
    },

    detection: {
      order: ['querystring', 'cookie', 'localStorage', 'navigator'],
      lookupQuerystring: 'lang',
      lookupCookie: 'lang',
      lookupLocalStorage: 'cncjs-lang',
      caches: ['localStorage', 'cookie'],
    },

    react: {
      useSuspense: true,
    },
  })

export default i18n


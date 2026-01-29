/**
 * Analytics service for frontend
 * Wraps Aptabase SDK with graceful error handling and privacy safeguards
 */

import { init, trackEvent } from '@aptabase/web'
import { isAnalyticsEnabled } from '@/config/analytics'

let initialized = false
let enabled = false

/**
 * Sanitize string values for privacy
 */
const sanitizeString = (value: unknown, maxLength = 200): string | null => {
  if (value === null || value === undefined) return null
  const str = String(value)
  if (str.length > maxLength) {
    return str.substring(0, maxLength) + '...'
  }
  return str
}

/**
 * Sanitize file path - remove full path, keep only filename
 */
const sanitizePath = (path: string): string => {
  if (!path) return ''
  // Remove full path, keep only filename
  const parts = path.split(/[/\\]/)
  return parts[parts.length - 1] || path
}

/**
 * Sanitize port name - remove full path, keep device name
 */
const sanitizePort = (port: string): string => {
  if (!port) return ''
  // Remove full path, keep device name (e.g., /dev/ttyUSB0 -> ttyUSB0, COM3 -> COM3)
  const parts = port.split(/[/\\]/)
  return parts[parts.length - 1] || port
}

/**
 * Check if a setting is camera-related (should not track values)
 */
const isCameraSetting = (category: string, key: string): boolean => {
  return category === 'camera' || key.toLowerCase().includes('camera')
}

/**
 * Sanitize event properties for privacy
 */
const sanitizeProperties = (properties: Record<string, unknown>): Record<string, string | number | null> => {
  const sanitized: Record<string, string | number | null> = {}
  
  for (const [key, value] of Object.entries(properties)) {
    // Skip null/undefined
    if (value === null || value === undefined) {
      sanitized[key] = null
      continue
    }
    
    // Handle different types
    if (typeof value === 'number') {
      // Pass numbers through unchanged
      sanitized[key] = value
    } else if (typeof value === 'boolean') {
      // Convert booleans to 1/0
      sanitized[key] = value ? 1 : 0
    } else if (typeof value === 'string') {
      // Special handling for paths and ports
      if (key === 'file_name' || key.includes('path')) {
        sanitized[key] = sanitizePath(value)
      } else if (key === 'port') {
        sanitized[key] = sanitizePort(value)
      } else {
        sanitized[key] = sanitizeString(value) || ''
      }
    } else {
      // Convert other types to string
      sanitized[key] = sanitizeString(String(value)) || ''
    }
  }
  
  return sanitized
}

/**
 * Initialize analytics
 * @param appKey - Aptabase app key
 * @param userEnabled - Whether user has enabled analytics
 * @param appVersion - App version
 */
export const initializeAnalytics = (appKey: string, userEnabled: boolean, appVersion?: string): void => {
  try {
    if (initialized) return
    
    if (!isAnalyticsEnabled(appKey, userEnabled)) {
      enabled = false
      return
    }
    
    // Initialize Aptabase
    init(appKey, { appVersion })
    initialized = true
    enabled = true
  } catch {
    // Fail silently - don't break the app if analytics fails
    enabled = false
  }
}

/**
 * Track an event
 * @param eventName - Event name
 * @param properties - Event properties (will be sanitized)
 */
export const track = (eventName: string, properties?: Record<string, unknown>): void => {
  try {
    if (!enabled || !initialized) return
    
    // Sanitize properties
    const sanitized = properties ? sanitizeProperties(properties) : undefined
    
    // Filter out null values (Aptabase doesn't accept null)
    const filtered = sanitized ? Object.fromEntries(
      Object.entries(sanitized).filter(([, value]) => value !== null)
    ) as Record<string, string | number> : undefined
    
    // Track event (non-blocking)
    trackEvent(eventName, filtered)
    
    // Log beacon that was sent
    console.log('[Analytics] 📊', eventName, filtered || {})
  } catch {
    // Fail silently - don't break the app if analytics fails
  }
}

/**
 * Track settings change (with special handling for camera settings and nested objects)
 */
export const trackSettingsChange = (
  category: string,
  key: string,
  value: unknown
): void => {
  try {
    if (!enabled || !initialized) return
    
    // Don't track camera values
    if (isCameraSetting(category, key)) {
      track('settings_changed', {
        setting_category: category,
        setting_key: key,
        setting_value: null, // Explicitly null for camera settings
      })
      return
    }
    
    // If value is an object or array, track each property separately
    if (value !== null && value !== undefined && typeof value === 'object' && !Array.isArray(value)) {
      for (const [nestedKey, nestedValue] of Object.entries(value)) {
        // Recursively track nested properties
        trackSettingsChange(category, `${key}.${nestedKey}`, nestedValue)
      }
      return
    }
    
    // Sanitize value
    let sanitizedValue: string | number | null = null
    if (value !== null && value !== undefined) {
      if (typeof value === 'number' || typeof value === 'boolean') {
        sanitizedValue = typeof value === 'number' ? value : (value ? 1 : 0)
      } else if (typeof value === 'string') {
        // Sanitize strings (remove paths, truncate)
        if (key === 'port' || key.endsWith('.port')) {
          sanitizedValue = sanitizePort(value)
        } else {
          sanitizedValue = sanitizeString(value, 100) || ''
        }
      } else if (Array.isArray(value)) {
        // For arrays, track as JSON string (truncated)
        sanitizedValue = sanitizeString(JSON.stringify(value), 200) || ''
      } else {
        sanitizedValue = sanitizeString(String(value), 100) || ''
      }
    }
    
    track('settings_changed', {
      setting_category: category,
      setting_key: key,
      setting_value: sanitizedValue,
    })
  } catch {
    // Fail silently - don't break the app if analytics fails
  }
}

/**
 * Track feature usage
 * @param feature - Feature name (e.g., "jog", "zero", "macro", "camera", "joystick", "spindle")
 * @param panel - Panel name (e.g., "JogPanel", "ProbePanel", "MacrosPanel", "SpindlePanel")
 * @param action - Action name (e.g., "jog_x", "zero_all", "run_macro", "toggle_spindle")
 * @param value - Optional value (e.g., jog distance, spindle speed, feedrate). Do NOT track for camera features.
 */
export const trackFeatureUsed = (
  feature: string,
  panel: string,
  action: string,
  value?: number | string | null
): void => {
  try {
    if (!enabled || !initialized) return
    
    // Don't track values for camera-related features
    if (feature === 'camera' || panel.toLowerCase().includes('camera')) {
      track('feature_used', {
        feature,
        panel,
        action,
        value: null, // Explicitly null for camera features
      })
      return
    }
    
    // Sanitize value if provided
    let sanitizedValue: number | string | null = null
    if (value !== null && value !== undefined) {
      if (typeof value === 'number') {
        sanitizedValue = value
      } else if (typeof value === 'string') {
        sanitizedValue = sanitizeString(value, 100) || ''
      }
    }
    
    track('feature_used', {
      feature,
      panel,
      action,
      value: sanitizedValue,
    })
  } catch {
    // Fail silently - don't break the app if analytics fails
  }
}

/**
 * Check if analytics is enabled
 */
export const isEnabled = (): boolean => {
  return enabled && initialized
}

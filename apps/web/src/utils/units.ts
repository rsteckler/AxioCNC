/**
 * Unit conversion utilities
 * 
 * Provides utilities for converting between metric (mm) and imperial (inches) units
 */

/**
 * Convert millimeters to inches for display
 * Returns empty string if input is null or undefined
 * 
 * @param mm - The value in millimeters (can be null or undefined)
 * @returns Formatted inches value as string, or empty string if input is null/undefined
 * 
 * @example
 * mmToInches(25.4) // '1'
 * mmToInches(12.7) // '0.5'
 * mmToInches(null) // ''
 */
export function mmToInches(mm: number | null | undefined): string {
  if (mm == null) return ''
  // 1 inch = 25.4 mm
  return (mm / 25.4).toFixed(4).replace(/\.?0+$/, '')
}

/**
 * Convert inches to millimeters
 * 
 * @param inches - The value in inches
 * @returns The value in millimeters
 * 
 * @example
 * inchesToMm(1) // 25.4
 * inchesToMm(0.5) // 12.7
 */
export function inchesToMm(inches: number): number {
  // 1 inch = 25.4 mm
  return inches * 25.4
}

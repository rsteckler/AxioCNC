import { useCallback } from 'react'
import { useDeleteExtensionsMutation } from '@/services/api'

/**
 * Hook for managing bitsetter tool reference clearing
 * 
 * When zeroing an axis (especially Z), the bitsetter reference becomes invalid
 * and should be cleared from the extensions store.
 */
export function useBitsetterReference() {
  const [deleteExtensions] = useDeleteExtensionsMutation()

  /**
   * Clear bitsetter reference for a specific WCS
   * Silently ignores 404 errors (key doesn't exist - nothing to clear)
   * 
   * @param wcs - Work Coordinate System (e.g., 'G54', 'G55')
   * @returns Promise that resolves when clearing is complete (or skipped)
   */
  const clearBitsetterReference = useCallback(async (wcs: string): Promise<void> => {
    try {
      const wcsKey = `bitsetter.toolReference.${wcs}`
      await deleteExtensions({ key: wcsKey }).unwrap()
    } catch (err: unknown) {
      // 404 means the key doesn't exist (nothing to clear) - this is fine, silently ignore it
      // RTK Query throws FetchBaseQueryError with status property
      // Type-safe error property access
      const errorRecord = typeof err === 'object' && err !== null ? err as Record<string, unknown> : null
      const status = 
        (errorRecord?.status as number | undefined) || 
        (typeof errorRecord?.data === 'object' && errorRecord.data !== null ? (errorRecord.data as Record<string, unknown>)?.status as number | undefined : undefined) || 
        undefined
      
      if (status !== 404 && status !== 'FETCH_ERROR') {
        console.error('Failed to clear bitsetter reference:', err)
      }
      // Otherwise silently ignore - nothing to clear
      // Don't block zeroing if clearing reference fails
    }
  }, [deleteExtensions])

  return {
    clearBitsetterReference,
  }
}

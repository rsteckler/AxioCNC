import { useCallback } from 'react'
import { runGcodeBatch } from '@/utils/runGcodeBatch'

export interface UseRunGcodeBatchOptions {
  signal?: AbortSignal
  waitForIdle?: boolean
}

/**
 * Hook that returns a function to run a G-code batch and wait for completion.
 * Uses runGcodeBatch with the connected port; rejects if no port is connected.
 */
export function useRunGcodeBatch(connectedPort: string | null) {
  const runBatch = useCallback(
    (gcode: string, options?: UseRunGcodeBatchOptions): Promise<void> => {
      if (!connectedPort) {
        return Promise.reject(new Error('No port connected'))
      }
      return runGcodeBatch({
        gcode,
        port: connectedPort,
        signal: options?.signal,
        waitForIdle: options?.waitForIdle,
      })
    },
    [connectedPort]
  )

  return { runBatch }
}

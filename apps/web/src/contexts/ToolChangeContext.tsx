import { createContext, useState, useCallback, ReactNode } from 'react'
import type { ZeroingMethod } from '../../../shared/src/schemas/settings'

interface ToolChangeContextValue {
  isToolChangePending: boolean
  toolChangeMethod: ZeroingMethod | 'ask' | null
  isFirstToolChange: boolean // For bitsetter: true if first tool change, false if subsequent
  forceSubsequentToolChange: boolean // Debug flag: forces bitsetter to appear as subsequent (testing)
  setForceSubsequentToolChange: (force: boolean) => void // Debug toggle
  triggerToolChange: (method: ZeroingMethod | 'ask', isFirstToolChange?: boolean) => void
  completeToolChange: () => void
}

// eslint-disable-next-line react-refresh/only-export-components
export const ToolChangeContext = createContext<ToolChangeContextValue | undefined>(undefined)

export function ToolChangeProvider({ children }: { children: ReactNode }) {
  const [isToolChangePending, setIsToolChangePending] = useState(false)
  const [toolChangeMethod, setToolChangeMethod] = useState<ZeroingMethod | 'ask' | null>(null)
  const [isFirstToolChange, setIsFirstToolChange] = useState(true)
  const [forceSubsequentToolChange, setForceSubsequentToolChange] = useState(false) // Debug flag

  const triggerToolChange = useCallback((method: ZeroingMethod | 'ask', isFirst = true) => {
    setToolChangeMethod(method)
    // If forceSubsequentToolChange is enabled, override to false (subsequent) for bitsetter
    const finalIsFirst = (method !== 'ask' && typeof method === 'object' && method.type === 'bitsetter' && forceSubsequentToolChange)
      ? false
      : isFirst
    setIsFirstToolChange(finalIsFirst)
    setIsToolChangePending(true)
  }, [forceSubsequentToolChange])

  const completeToolChange = useCallback(() => {
    setIsToolChangePending(false)
    setToolChangeMethod(null)
    setIsFirstToolChange(true) // Reset to default
  }, [])

  return (
    <ToolChangeContext.Provider
      value={{
        isToolChangePending,
        toolChangeMethod,
        isFirstToolChange,
        forceSubsequentToolChange,
        setForceSubsequentToolChange,
        triggerToolChange,
        completeToolChange,
      }}
    >
      {children}
    </ToolChangeContext.Provider>
  )
}

// Export the context for useToolChange hook (now in separate file)
// eslint-disable-next-line react-refresh/only-export-components
export { useToolChange } from '@/hooks/useToolChange'

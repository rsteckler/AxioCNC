import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import type { ZeroingMethod } from '../../../shared/schemas/settings'

interface ToolChangeContextValue {
  isToolChangePending: boolean
  toolChangeMethod: ZeroingMethod | 'ask' | 'skip' | null
  triggerToolChange: (method: ZeroingMethod | 'ask' | 'skip') => void
  completeToolChange: () => void
}

const ToolChangeContext = createContext<ToolChangeContextValue | undefined>(undefined)

export function ToolChangeProvider({ children }: { children: ReactNode }) {
  const [isToolChangePending, setIsToolChangePending] = useState(false)
  const [toolChangeMethod, setToolChangeMethod] = useState<ZeroingMethod | 'ask' | 'skip' | null>(null)

  const triggerToolChange = useCallback((method: ZeroingMethod | 'ask' | 'skip') => {
    setToolChangeMethod(method)
    setIsToolChangePending(true)
  }, [])

  const completeToolChange = useCallback(() => {
    setIsToolChangePending(false)
    setToolChangeMethod(null)
  }, [])

  return (
    <ToolChangeContext.Provider
      value={{
        isToolChangePending,
        toolChangeMethod,
        triggerToolChange,
        completeToolChange,
      }}
    >
      {children}
    </ToolChangeContext.Provider>
  )
}

export function useToolChange() {
  const context = useContext(ToolChangeContext)
  if (context === undefined) {
    throw new Error('useToolChange must be used within a ToolChangeProvider')
  }
  return context
}

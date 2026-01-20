import { useContext } from 'react'
import { ToolChangeContext } from '@/contexts/ToolChangeContext'

export function useToolChange() {
  const context = useContext(ToolChangeContext)
  if (context === undefined) {
    throw new Error('useToolChange must be used within a ToolChangeProvider')
  }
  return context
}

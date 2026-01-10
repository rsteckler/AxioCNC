import React from 'react'

interface EmptyStateProps {
  message: string
  className?: string
  padding?: 'sm' | 'md' | 'lg'
}

/**
 * Reusable empty state component
 * 
 * Displays a centered message when no data is available
 */
export function EmptyState({ 
  message, 
  className = '',
  padding = 'md' 
}: EmptyStateProps) {
  const paddingClass = {
    sm: 'py-4',
    md: 'py-8',
    lg: 'py-12',
  }[padding]

  return (
    <div className={`p-3 space-y-2 ${className}`}>
      <div className={`text-sm text-muted-foreground text-center ${paddingClass}`}>
        {message}
      </div>
    </div>
  )
}

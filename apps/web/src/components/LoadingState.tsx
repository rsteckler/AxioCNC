interface LoadingStateProps {
  message?: string
  className?: string
}

/**
 * Reusable loading state component
 * 
 * Displays a centered loading message with consistent styling
 */
export function LoadingState({ message = 'Loading...', className = '' }: LoadingStateProps) {
  return (
    <div className={`p-3 space-y-2 ${className}`}>
      <div className="text-sm text-muted-foreground text-center py-4">
        {message}
      </div>
    </div>
  )
}

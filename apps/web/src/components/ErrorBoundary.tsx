/**
 * Error Boundary component to catch React errors and track them
 */

import { Component, ErrorInfo, ReactNode } from 'react'
import i18n from '@/i18n'
import { track } from '@/services/analytics'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Track error to analytics
    try {
      track('error_occurred', {
        error_type: error.name || 'Error',
        error_message: error.message || 'Unknown error',
        component: errorInfo.componentStack?.split('\n')[0] || 'unknown',
        stack: error.stack?.substring(0, 500) || '', // Truncate stack trace
      })
    } catch (analyticsError) {
      // Don't break if analytics fails
      if (import.meta.env.DEV) {
        console.warn('[ErrorBoundary] Failed to track error:', analyticsError)
      }
    }

    // Log to console in dev
    if (import.meta.env.DEV) {
      console.error('[ErrorBoundary] Caught error:', error, errorInfo)
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="flex items-center justify-center min-h-screen p-4">
          <div className="text-center space-y-4 max-w-md">
            <h1 className="text-2xl font-bold text-destructive">{i18n.t('Something went wrong')}</h1>
            <p className="text-muted-foreground">
              {i18n.t('An error occurred while rendering this page. Please refresh to try again.')}
            </p>
            {this.state.error && import.meta.env.DEV && (
              <details className="mt-4 text-left">
                <summary className="cursor-pointer text-sm text-muted-foreground">
                  {i18n.t('Error details (dev only)')}
                </summary>
                <pre className="mt-2 p-4 bg-muted rounded text-xs overflow-auto">
                  {this.state.error.toString()}
                  {this.state.error.stack && (
                    <>
                      {'\n\n'}
                      {this.state.error.stack}
                    </>
                  )}
                </pre>
              </details>
            )}
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
            >
              {i18n.t('Refresh Page')}
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

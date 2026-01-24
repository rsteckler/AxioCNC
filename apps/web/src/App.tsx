import { useCallback, useEffect, useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { ThemeProvider } from '@/components/theme-provider'
import { ToolChangeProvider } from '@/contexts/ToolChangeContext'
import { useSignInMutation } from '@/services/api'
import { socketService } from '@/services/socket'
import { machineStateSync } from '@/services/machineStateSync'
import Settings from '@/routes/Settings'
import Setup from '@/routes/Setup'
import Monitor from '@/routes/Monitor'
import Stats from '@/routes/Stats'

function App() {
  const [signIn] = useSignInMutation()
  const [authReady, setAuthReady] = useState(false)

  // Basic JWT format validation
  const isValidJwtFormat = (token: string): boolean => {
    if (!token || typeof token !== 'string') return false

    // JWT should have exactly 2 dots (header.payload.signature)
    const parts = token.split('.')
    if (parts.length !== 3) return false

    // Each part should be base64url encoded (no padding, URL-safe chars)
    return parts.every(part => /^[A-Za-z0-9_-]+$/.test(part))
  }

  // Extract authentication logic to be reusable
  const authenticate = useCallback(async () => {
    try {
      // Check for existing token
      let token = localStorage.getItem('axiocnc-token')

      // Validate token format - if it's malformed, treat as missing
      if (token && !isValidJwtFormat(token)) {
        console.warn('[App] Invalid token format, clearing and getting new token')
        localStorage.removeItem('axiocnc-token')
        token = null
      }

      // If no token, get one via signin (works even without users configured)
      if (!token) {
        try {
          const result = await signIn({ token: '' }).unwrap()
          token = result.token
          if (token) {
            localStorage.setItem('axiocnc-token', token)
          }
        } catch (err) {
          console.error('Failed to authenticate:', err)
          // Still mark as ready even if auth fails - let components handle errors
          setAuthReady(true)
          return
        }
      }

      // Connect Socket.IO with token if available
      if (token) {
        socketService.connect(token)

        // Initialize machine state sync after socket connects
        if (socketService.isConnected()) {
          machineStateSync.init()
          } else {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (socketService as any).once?.('connect', () => {
              machineStateSync.init()
            })
          }
      }

      // Mark auth as ready so components can make API calls
      setAuthReady(true)
    } catch (err) {
      console.error('Auth initialization error:', err)
      setAuthReady(true) // Still render, let components handle errors
    }
  }, [signIn])

  // Auto-authenticate on app load
  useEffect(() => {
    // Set up socket service to handle token invalidation
    socketService.setTokenInvalidCallback(() => {
      console.log('[App] Token invalid, refreshing authentication...')
      // Reset auth state and re-authenticate
      setAuthReady(false)
      authenticate()
    })

    authenticate()

    // Cleanup on unmount
    return () => {
      socketService.disconnect()
      machineStateSync.cleanup()
    }
  }, [authenticate])

  // Show loading state while authenticating
  if (!authReady) {
    return (
      <ThemeProvider defaultTheme="dark" storageKey="axiocnc-ui-theme">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="text-lg">Initializing...</div>
          </div>
        </div>
      </ThemeProvider>
    )
  }

  return (
    <ThemeProvider defaultTheme="dark" storageKey="cncjs-ui-theme">
      <ToolChangeProvider>
        <Routes>
          <Route path="/" element={<Setup />} />
          <Route path="/monitor" element={<Monitor />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/test" element={<TestPage />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </ToolChangeProvider>
    </ThemeProvider>
  )
}

export default App


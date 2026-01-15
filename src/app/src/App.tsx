import { useEffect, useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { ThemeProvider } from '@/components/theme-provider'
import { useSignInMutation } from '@/services/api'
import { socketService } from '@/services/socket'
import { machineStateSync } from '@/services/machineStateSync'
import TestPage from '@/routes/TestPage'
import Settings from '@/routes/Settings'
import Setup from '@/routes/Setup'
import Monitor from '@/routes/Monitor'

function App() {
  const [signIn] = useSignInMutation()
  const [authReady, setAuthReady] = useState(false)

  // Auto-authenticate on app load
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Check for existing token
        let token = localStorage.getItem('axiocnc-token')
        
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
            socketService.once?.('connect', () => {
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
    }

    initAuth()

    // Cleanup on unmount
    return () => {
      socketService.disconnect()
      machineStateSync.cleanup()
    }
  }, [signIn])

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
      <Routes>
        <Route path="/" element={<Setup />} />
        <Route path="/monitor" element={<Monitor />} />
        <Route path="/test" element={<TestPage />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </ThemeProvider>
  )
}

export default App


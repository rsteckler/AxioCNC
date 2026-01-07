import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useGetControllersQuery, useSignInMutation } from '@/services/api'
import { socketService } from '@/services/socket'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Wifi, WifiOff, RefreshCw, Settings } from 'lucide-react'

export default function TestPage() {
  const [socketConnected, setSocketConnected] = useState(false)
  const [socketEvents, setSocketEvents] = useState<string[]>([])
  const [signIn] = useSignInMutation()
  
  // RTK Query hook for fetching controllers
  const { data, error, isLoading, refetch } = useGetControllersQuery()

  // Auto-signin and connect Socket.IO on mount (like legacy app)
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Check for existing token
        let token = localStorage.getItem('cncjs-token')
        
        // If no token, get one via signin (works even without users configured)
        if (!token) {
          addEvent('No token found, requesting from server...')
          const result = await signIn({ token: '' }).unwrap()
          token = result.token
          if (token) {
            localStorage.setItem('cncjs-token', token)
            addEvent(`Got token (session enabled: ${result.enabled ?? false})`)
          }
        } else {
          addEvent('Using existing token from localStorage')
        }

        // Connect Socket.IO with token
        if (token) {
          const socket = socketService.connect(token)
          
          if (socket) {
            socket.on('connect', () => {
              setSocketConnected(true)
              addEvent('Connected to Socket.IO')
            })

            socket.on('disconnect', () => {
              setSocketConnected(false)
              addEvent('Disconnected from Socket.IO')
            })

            socket.on('error', (err: unknown) => {
              addEvent(`Socket error: ${String(err)}`)
            })

            // Listen for some common events
            socket.on('serialport:list', (ports: unknown) => {
              addEvent(`serialport:list - ${JSON.stringify(ports).slice(0, 100)}...`)
            })

            socket.on('controller:state', (state: unknown) => {
              addEvent(`controller:state - received`)
              console.log('Controller state:', state)
            })
          }
        }
      } catch (err) {
        addEvent(`Auth error: ${String(err)}`)
      }
    }

    initAuth()

    return () => {
      socketService.disconnect()
    }
  }, [signIn])

  const addEvent = (event: string) => {
    setSocketEvents(prev => [...prev.slice(-9), `${new Date().toLocaleTimeString()}: ${event}`])
  }

  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-bold text-primary">CNCjs</h1>
          <p className="text-muted-foreground">New Frontend - Backend Integration Test</p>
        </div>
        <Link to="/settings">
          <Button variant="outline" size="icon">
            <Settings className="h-5 w-5" />
          </Button>
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* REST API Test Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              REST API
            </CardTitle>
            <CardDescription>
              Testing RTK Query connection to /api/controllers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Button onClick={() => refetch()} disabled={isLoading}>
                {isLoading ? 'Loading...' : 'Fetch Controllers'}
              </Button>
              
              {error && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm">
                  Error: {(error as { status?: number })?.status === 401 
                    ? 'Unauthorized - need to authenticate first' 
                    : 'Failed to fetch controllers'}
                </div>
              )}
              
              {data && (
                <div className="p-3 bg-primary/10 border border-primary/20 rounded-md text-sm">
                  <p className="font-medium mb-2">Active Controllers:</p>
                  {data.controllers && data.controllers.length > 0 ? (
                    <ul className="list-disc list-inside">
                      {data.controllers.map((ctrl, i) => (
                        <li key={i}>{ctrl.port} ({ctrl.controllerType})</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted-foreground">No active controllers</p>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Socket.IO Test Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {socketConnected ? (
                <Wifi className="h-5 w-5 text-primary" />
              ) : (
                <WifiOff className="h-5 w-5 text-destructive" />
              )}
              Socket.IO
            </CardTitle>
            <CardDescription>
              Real-time connection status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
                socketConnected 
                  ? 'bg-primary/10 text-primary' 
                  : 'bg-destructive/10 text-destructive'
              }`}>
                <span className={`w-2 h-2 rounded-full ${
                  socketConnected ? 'bg-primary' : 'bg-destructive'
                }`} />
                {socketConnected ? 'Connected' : 'Disconnected'}
              </div>

              <div className="p-3 bg-muted rounded-md text-sm max-h-48 overflow-y-auto font-mono">
                <p className="font-medium mb-2 font-sans">Event Log:</p>
                {socketEvents.length > 0 ? (
                  socketEvents.map((event, i) => (
                    <div key={i} className="text-xs text-muted-foreground">{event}</div>
                  ))
                ) : (
                  <p className="text-muted-foreground text-xs">No events yet...</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Instructions */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Status</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm dark:prose-invert">
          <div className="space-y-3 text-sm text-muted-foreground">
            <p><strong>REST API:</strong> Working! "No active controllers" is correct - no CNC machine is connected.</p>
            <p><strong>Socket.IO:</strong> Requires authentication token. In dev mode, the server allows REST without auth but Socket.IO still needs a token from <code className="bg-muted px-1.5 py-0.5 rounded">/api/signin</code>.</p>
            <p className="text-xs mt-4 pt-4 border-t border-border">
              Backend: <code className="bg-muted px-1.5 py-0.5 rounded">yarn start-server-dev</code> | 
              Frontend: <code className="bg-muted px-1.5 py-0.5 rounded">cd src/app && npm run dev</code>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}


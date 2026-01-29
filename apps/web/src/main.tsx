import { StrictMode, Suspense, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { BrowserRouter } from 'react-router-dom'
import { store } from './store'
import App from './App'
import './index.css'

// Initialize i18n (must be imported before App)
import { i18nReady } from './i18n'

const loadingFallback = (
  <div className="flex items-center justify-center min-h-screen">Loading...</div>
)

function Root() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    i18nReady.then(() => setReady(true))
  }, [])
  if (!ready) return loadingFallback
  return (
    <Suspense fallback={loadingFallback}>
      <Provider store={store}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </Provider>
    </Suspense>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)


import { Routes, Route } from 'react-router-dom'
import { ThemeProvider } from '@/components/theme-provider'
import TestPage from '@/routes/TestPage'
import Settings from '@/routes/Settings'

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="cncjs-ui-theme">
      <Routes>
        <Route path="/" element={<TestPage />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </ThemeProvider>
  )
}

export default App


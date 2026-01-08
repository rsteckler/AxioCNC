import { Routes, Route } from 'react-router-dom'
import { ThemeProvider } from '@/components/theme-provider'
import TestPage from '@/routes/TestPage'
import Settings from '@/routes/Settings'
import SetupMockup from '@/routes/SetupMockup'

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="cncjs-ui-theme">
      <Routes>
        <Route path="/" element={<SetupMockup />} />
        <Route path="/test" element={<TestPage />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </ThemeProvider>
  )
}

export default App


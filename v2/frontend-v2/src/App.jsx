import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import useAuthStore from './store/authStore'
import useUIStore, { checkAutoDarkMode } from './store/uiStore'
import { useEffect } from 'react'

// Pages
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import StockReceive from './pages/StockReceive'
import StockTransfer from './pages/StockTransfer'
import Reports from './pages/Reports'
import Settings from './pages/Settings'

// Layout
import Layout from './components/Layout'

// Protected Route
function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuthStore()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return children
}

function App() {
  const { darkMode } = useUIStore()

  useEffect(() => {
    // Check dark mode on mount
    checkAutoDarkMode()

    // Apply dark class to html
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [darkMode])

  return (
    <BrowserRouter>
      <div className="min-h-screen">
        {/* Noise texture overlay */}
        <div className="noise-overlay" />

        {/* Routes */}
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="receive" element={<StockReceive />} />
            <Route path="transfer" element={<StockTransfer />} />
            <Route path="reports" element={<Reports />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>

        {/* Toast notifications */}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: darkMode ? '#1f2937' : '#fff',
              color: darkMode ? '#f3f4f6' : '#111827',
            },
            success: {
              iconTheme: {
                primary: '#8A2A2B',
                secondary: '#fff',
              },
            },
          }}
        />
      </div>
    </BrowserRouter>
  )
}

export default App

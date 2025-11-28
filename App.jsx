import React, { useState, useEffect, useCallback } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import Login from './components/Login'
import Dashboard from './components/Dashboard'
import StockReceive from './components/StockReceive'
import StockTransfer from './components/StockTransfer'
import Reports from './components/Reports'
import Settings from './components/Settings'
import Navigation from './components/Navigation'
import { HeartbeatProvider } from './contexts/HeartbeatContext'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { NotificationProvider } from './contexts/NotificationContext'

// Protected Route Component
function ProtectedRoute({ children }) {
  const { user } = useAuth()
  return user ? children : <Navigate to="/login" replace />
}

// Main App Layout
function AppLayout({ children }) {
  const { user } = useAuth()
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-sand-50 via-white to-sand-100">
      {/* Noise texture overlay */}
      <div className="noise-overlay" />
      
      {/* Navigation */}
      {user && <Navigation />}
      
      {/* Main Content */}
      <main className={`${user ? 'pl-64' : ''} transition-all duration-300`}>
        <AnimatePresence mode="wait">
          {children}
        </AnimatePresence>
      </main>
      
      {/* Background decorative elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-maroon-200/10 rounded-full blur-3xl animate-float" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-ochre-200/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '3s' }} />
      </div>
    </div>
  )
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <HeartbeatProvider>
          <NotificationProvider>
            <Routes>
              <Route path="/login" element={
                <AppLayout>
                  <Login />
                </AppLayout>
              } />
              
              <Route path="/" element={
                <ProtectedRoute>
                  <AppLayout>
                    <Dashboard />
                  </AppLayout>
                </ProtectedRoute>
              } />
              
              <Route path="/receive" element={
                <ProtectedRoute>
                  <AppLayout>
                    <StockReceive />
                  </AppLayout>
                </ProtectedRoute>
              } />
              
              <Route path="/transfer" element={
                <ProtectedRoute>
                  <AppLayout>
                    <StockTransfer />
                  </AppLayout>
                </ProtectedRoute>
              } />
              
              <Route path="/reports" element={
                <ProtectedRoute>
                  <AppLayout>
                    <Reports />
                  </AppLayout>
                </ProtectedRoute>
              } />
              
              <Route path="/settings" element={
                <ProtectedRoute>
                  <AppLayout>
                    <Settings />
                  </AppLayout>
                </ProtectedRoute>
              } />
            </Routes>
          </NotificationProvider>
        </HeartbeatProvider>
      </AuthProvider>
    </Router>
  )
}

export default App

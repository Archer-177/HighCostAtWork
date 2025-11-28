import React, { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext()

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const savedUser = sessionStorage.getItem('user')
    return savedUser ? JSON.parse(savedUser) : null
  })
  const [loading, setLoading] = useState(false)

  const login = async (username, password) => {
    setLoading(true)
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })

      const data = await response.json()

      if (data.success) {
        setUser(data.user)
        sessionStorage.setItem('user', JSON.stringify(data.user))
        return { success: true }
      } else {
        return { success: false, error: data.error }
      }
    } catch (error) {
      return { success: false, error: 'Connection failed' }
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    setUser(null)
    sessionStorage.removeItem('user')
  }

  const value = {
    user,
    login,
    logout,
    loading,
    isPharmacist: user?.role === 'PHARMACIST',
    isPharmacyTech: user?.role === 'PHARMACY_TECH',
    isNurse: user?.role === 'NURSE',
    canReceiveStock: user?.role === 'PHARMACIST' || user?.role === 'PHARMACY_TECH',
    canTransferStock: user?.role === 'PHARMACIST' || user?.role === 'PHARMACY_TECH',
    canApproveTransfers: user?.role === 'PHARMACIST' && user?.can_delegate,
    canViewReports: user?.role === 'PHARMACIST' || user?.role === 'PHARMACY_TECH',
    canManageSettings: user?.role === 'PHARMACIST'
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

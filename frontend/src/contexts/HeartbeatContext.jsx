import React, { createContext, useContext, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'

const HeartbeatContext = createContext()

export function useHeartbeat() {
  const context = useContext(HeartbeatContext)
  if (!context) {
    throw new Error('useHeartbeat must be used within a HeartbeatProvider')
  }
  return context
}

const WARN_TIME = 9 * 60 * 1000  // 9 minutes
const SOFT_LOGOUT = 9.5 * 60 * 1000  // 9.5 minutes
const HARD_LOGOUT = 10 * 60 * 1000  // 10 minutes

export function HeartbeatProvider({ children }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const lastActivity = useRef(Date.now())
  const heartbeatInterval = useRef(null)
  const activityInterval = useRef(null)
  const isActive = useRef(true)

  const sendHeartbeat = async () => {
    if (!isActive.current) return

    try {
      await fetch('/api/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
    } catch (error) {
      console.error('Heartbeat failed:', error)
    }
  }

  const updateActivity = () => {
    lastActivity.current = Date.now()
  }

  const checkInactivity = () => {
    if (!user) return

    const now = Date.now()
    const timeSinceActivity = now - lastActivity.current

    if (timeSinceActivity > HARD_LOGOUT) {
      // Hard logout - stop heartbeat and redirect to shutdown
      isActive.current = false
      navigate('/shutdown')
    } else if (timeSinceActivity > SOFT_LOGOUT) {
      // Soft logout - clear session but keep heartbeat
      // Do NOT call logout() here as it stops the heartbeat
      // Instead, just clear the user state if needed, or rely on the UI to show the login screen
      // For this implementation, we'll assume the UI handles the "soft" state
      if (user) {
        // Optionally notify user or set a "soft locked" state
        console.log("Soft logout - heartbeat continues")
      }
    } else if (timeSinceActivity > WARN_TIME) {
      // Show warning (handled by UI)
    }
  }

  useEffect(() => {
    // Start heartbeat immediately
    heartbeatInterval.current = setInterval(sendHeartbeat, 5000)

    if (user) {
      // Start inactivity check
      activityInterval.current = setInterval(checkInactivity, 1000)

      // Track user activity
      const events = ['mousedown', 'keydown', 'scroll', 'touchstart']
      events.forEach(event => {
        document.addEventListener(event, updateActivity)
      })

      return () => {
        clearInterval(heartbeatInterval.current)
        clearInterval(activityInterval.current)
        events.forEach(event => {
          document.removeEventListener(event, updateActivity)
        })
      }
    } else {
      // If not logged in, we still need to clear the heartbeat interval on unmount
      return () => {
        clearInterval(heartbeatInterval.current)
      }
    }
  }, [user, logout])

  const value = {
    lastActivity: lastActivity.current,
    updateActivity
  }

  return (
    <HeartbeatContext.Provider value={value}>
      {children}
    </HeartbeatContext.Provider>
  )
}

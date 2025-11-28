import React, { createContext, useContext, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, AlertCircle, XCircle, Info, X } from 'lucide-react'

const NotificationContext = createContext()

export function useNotification() {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider')
  }
  return context
}

const notificationIcons = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertCircle,
  info: Info
}

const notificationColors = {
  success: 'from-emerald-50 to-emerald-100 border-emerald-300 text-emerald-900',
  error: 'from-red-50 to-red-100 border-red-300 text-red-900',
  warning: 'from-amber-50 to-amber-100 border-amber-300 text-amber-900',
  info: 'from-blue-50 to-blue-100 border-blue-300 text-blue-900'
}

function Notification({ notification, onClose }) {
  const Icon = notificationIcons[notification.type]
  const colorClass = notificationColors[notification.type]

  return (
    <motion.div
      initial={{ opacity: 0, x: 400, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 400, scale: 0.9 }}
      className={`relative flex items-start gap-3 p-4 rounded-xl bg-gradient-to-r ${colorClass} 
                  border shadow-lg backdrop-blur-sm max-w-md`}
    >
      <Icon className="w-5 h-5 mt-0.5 flex-shrink-0" />
      <div className="flex-1">
        <h4 className="font-semibold text-sm">{notification.title}</h4>
        {notification.message && (
          <p className="text-sm mt-0.5 opacity-90">{notification.message}</p>
        )}
      </div>
      <button
        onClick={() => onClose(notification.id)}
        className="flex-shrink-0 p-1 hover:bg-black/10 rounded-lg transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  )
}

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([])

  const showNotification = useCallback((title, message = '', type = 'info', duration = 5000) => {
    const id = Date.now()
    const notification = { id, title, message, type }
    
    setNotifications(prev => [...prev, notification])
    
    if (duration > 0) {
      setTimeout(() => {
        removeNotification(id)
      }, duration)
    }
    
    return id
  }, [])

  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }, [])

  const value = {
    showNotification,
    removeNotification,
    success: (title, message, duration) => showNotification(title, message, 'success', duration),
    error: (title, message, duration) => showNotification(title, message, 'error', duration),
    warning: (title, message, duration) => showNotification(title, message, 'warning', duration),
    info: (title, message, duration) => showNotification(title, message, 'info', duration),
  }

  return (
    <NotificationContext.Provider value={value}>
      {children}
      
      {/* Notification Container */}
      <div className="fixed top-4 right-4 z-50 space-y-3">
        <AnimatePresence>
          {notifications.map(notification => (
            <Notification
              key={notification.id}
              notification={notification}
              onClose={removeNotification}
            />
          ))}
        </AnimatePresence>
      </div>
    </NotificationContext.Provider>
  )
}

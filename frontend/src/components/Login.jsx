import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Lock, User, Heart, Pill, Activity, Shield } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useNotification } from '../contexts/NotificationContext'

export default function Login() {
  const navigate = useNavigate()
  const { login, loading } = useAuth()
  const { error, success } = useNotification()
  const [formData, setFormData] = useState({ username: '', password: '' })

  const handleSubmit = async (e) => {
    e.preventDefault()

    const result = await login(formData.username, formData.password)

    if (result.success) {
      success('Welcome back!', 'Log in successful')
      navigate('/')
    } else {
      error('Log In Failed', result.error || 'Invalid credentials')
    }
  }

  const floatingIcons = [
    { Icon: Heart, delay: 0, x: '10%', y: '20%' },
    { Icon: Pill, delay: 1, x: '85%', y: '15%' },
    { Icon: Activity, delay: 2, x: '90%', y: '70%' },
    { Icon: Shield, delay: 1.5, x: '5%', y: '75%' },
  ]

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      {/* Animated background icons */}
      {floatingIcons.map(({ Icon, delay, x, y }, index) => (
        <motion.div
          key={index}
          className="absolute text-maroon-200/20 dark:text-maroon-800/20"
          style={{ left: x, top: y }}
          animate={{
            y: [0, -30, 0],
            rotate: [0, 10, -10, 0],
          }}
          transition={{
            duration: 6,
            delay,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        >
          <Icon size={60} strokeWidth={1} />
        </motion.div>
      ))}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", duration: 0.8 }}
            className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-maroon-600 to-maroon-800 
                     rounded-2xl shadow-2xl mb-4"
          >
            <Heart className="w-10 h-10 text-white" fill="currentColor" />
          </motion.div>

          <h1 className="text-4xl font-display tracking-wider gradient-text mb-2">
            FUNLHN MEDICINE TRACKER
          </h1>
          <p className="text-gray-600 dark:text-gray-400 font-medium">
            High-Cost Medicine Management System
          </p>
        </div>

        {/* Login Form */}
        <motion.form
          onSubmit={handleSubmit}
          className="glass rounded-2xl p-8 shadow-2xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Username
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full pl-12 pr-4 py-3 bg-white/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl
                           focus:outline-none focus:border-maroon-500 focus:bg-white dark:focus:bg-gray-800 transition-all dark:text-white"
                  placeholder="Enter your username"
                  required
                />
                <User className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Password
                </label>
                <a
                  href="/forgot-password"
                  onClick={(e) => { e.preventDefault(); navigate('/forgot-password'); }}
                  className="text-sm text-maroon-600 dark:text-maroon-400 hover:text-maroon-800 dark:hover:text-maroon-300 font-medium"
                >
                  Forgot Password?
                </a>
              </div>
              <div className="relative">
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full pl-12 pr-4 py-3 bg-white/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl
                           focus:outline-none focus:border-maroon-500 focus:bg-white dark:focus:bg-gray-800 transition-all dark:text-white"
                  placeholder="Enter your password"
                  required
                />
                <Lock className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-maroon-600 to-maroon-800 text-white font-semibold
                       rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all
                       disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden group"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <span className="spinner w-5 h-5 mr-2" />
                  Logging in...
                </span>
              ) : (
                <>
                  <span className="relative z-10">Log In</span>
                  <div className="absolute inset-0 bg-gradient-to-r from-maroon-700 to-maroon-900 
                                transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
                </>
              )}
            </button>
          </div>

          {/* Demo Credentials */}

        </motion.form>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6"
        >
          © 2025 Developed by John Ali
        </motion.p>
      </motion.div>
    </div>
  )
}

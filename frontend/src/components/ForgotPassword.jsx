import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { User, Key, Lock, ArrowRight, CheckCircle, ArrowLeft, Smartphone } from 'lucide-react'
import { useNotification } from '../contexts/NotificationContext'

export default function ForgotPassword() {
    const navigate = useNavigate()
    const { success, error: showError } = useNotification()

    const [step, setStep] = useState(1) // 1: Username, 2: Code & New Password
    const [username, setUsername] = useState('')
    const [code, setCode] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [loading, setLoading] = useState(false)

    const handleRequestCode = async (e) => {
        e.preventDefault()
        setLoading(true)
        try {
            const response = await fetch('/api/forgot_password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username })
            })

            const data = await response.json()

            if (response.ok) {
                success('Code Sent', data.message)
                setStep(2)
            } else {
                showError('Error', data.error || 'Failed to send code')
            }
        } catch (err) {
            showError('Connection Error', 'Failed to connect to server')
        } finally {
            setLoading(false)
        }
    }

    const handleResetPassword = async (e) => {
        e.preventDefault()

        if (newPassword.length < 6) {
            showError('Invalid Password', 'Password must be at least 6 characters long')
            return
        }

        if (newPassword !== confirmPassword) {
            showError('Password Mismatch', 'Passwords do not match')
            return
        }

        setLoading(true)
        try {
            const response = await fetch('/api/reset_password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, code, newPassword })
            })

            const data = await response.json()

            if (response.ok) {
                success('Password Reset', 'Your password has been reset. Please log in.')
                navigate('/login')
            } else {
                showError('Reset Failed', data.error || 'Failed to reset password')
            }
        } catch (err) {
            showError('Connection Error', 'Failed to connect to server')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-sand-50 via-white to-sand-100 flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden relative"
            >
                {/* Header */}
                <div className="bg-maroon-600 px-8 py-6 text-white text-center relative">
                    <Link to="/login" className="absolute left-4 top-1/2 -translate-y-1/2 p-2 hover:bg-white/10 rounded-full transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Key className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold">Reset Password</h2>
                    <p className="text-maroon-100 mt-2 text-sm">
                        {step === 1 ? "Enter your username to receive a code" : "Enter the code sent to your mobile"}
                    </p>
                </div>

                <div className="p-8">
                    <AnimatePresence mode="wait">
                        {step === 1 ? (
                            <motion.form
                                key="step1"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                onSubmit={handleRequestCode}
                                className="space-y-6"
                            >
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Username
                                    </label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                        <input
                                            type="text"
                                            value={username}
                                            onChange={(e) => setUsername(e.target.value)}
                                            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none 
                                     focus:ring-2 focus:ring-maroon-500 focus:border-transparent transition-all"
                                            placeholder="Enter your username"
                                            required
                                        />
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                                        <Smartphone className="w-3 h-3" />
                                        We'll send a verification code to your registered mobile number.
                                    </p>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full py-3 bg-maroon-600 hover:bg-maroon-700 text-white font-bold rounded-xl
                                 shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5
                                 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {loading ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            <span>Send Code</span>
                                            <ArrowRight className="w-5 h-5" />
                                        </>
                                    )}
                                </button>
                            </motion.form>
                        ) : (
                            <motion.form
                                key="step2"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                onSubmit={handleResetPassword}
                                className="space-y-6"
                            >
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Verification Code
                                    </label>
                                    <div className="relative">
                                        <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                        <input
                                            type="text"
                                            value={code}
                                            onChange={(e) => setCode(e.target.value)}
                                            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none 
                                     focus:ring-2 focus:ring-maroon-500 focus:border-transparent transition-all tracking-widest text-center font-mono text-lg"
                                            placeholder="000000"
                                            maxLength={6}
                                            required
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        New Password
                                    </label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                        <input
                                            type="password"
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none 
                                     focus:ring-2 focus:ring-maroon-500 focus:border-transparent transition-all"
                                            placeholder="Enter new password"
                                            required
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Confirm Password
                                    </label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                        <input
                                            type="password"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none 
                                     focus:ring-2 focus:ring-maroon-500 focus:border-transparent transition-all"
                                            placeholder="Confirm new password"
                                            required
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full py-3 bg-maroon-600 hover:bg-maroon-700 text-white font-bold rounded-xl
                                 shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5
                                 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {loading ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            <CheckCircle className="w-5 h-5" />
                                            <span>Reset Password</span>
                                        </>
                                    )}
                                </button>
                            </motion.form>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
        </div>
    )
}

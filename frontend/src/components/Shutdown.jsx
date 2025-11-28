import React from 'react'
import { Power } from 'lucide-react'
import { motion } from 'framer-motion'

export default function Shutdown() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-6">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center"
            >
                <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Power className="w-10 h-10 text-red-600" />
                </div>

                <h1 className="text-2xl font-bold text-gray-900 mb-4">
                    Application Shut Down
                </h1>

                <p className="text-gray-600 mb-8">
                    To ensure security and performance, the application has closed due to inactivity.
                </p>

                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 text-sm text-gray-500">
                    <p className="font-medium text-gray-700 mb-2">How to restart:</p>
                    <ol className="list-decimal list-inside space-y-1 text-left pl-4">
                        <li>Close this window</li>
                        <li>Launch <strong>FUNLHN Medicine Tracker</strong> from your desktop</li>
                    </ol>
                </div>
            </motion.div>
        </div>
    )
}

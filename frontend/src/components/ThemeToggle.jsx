import React from 'react'
import { Sun, Moon } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import { motion } from 'framer-motion'

export default function ThemeToggle() {
    const { theme, toggleTheme } = useTheme()

    return (
        <button
            onClick={toggleTheme}
            className="p-2 rounded-lg bg-sand-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 
                 hover:bg-sand-200 dark:hover:bg-gray-700 transition-colors relative overflow-hidden"
            aria-label="Toggle theme"
        >
            <motion.div
                initial={false}
                animate={{
                    rotate: theme === 'dark' ? 180 : 0,
                    scale: theme === 'dark' ? 0 : 1,
                    opacity: theme === 'dark' ? 0 : 1
                }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0 flex items-center justify-center"
            >
                <Sun className="w-5 h-5" />
            </motion.div>

            <motion.div
                initial={false}
                animate={{
                    rotate: theme === 'dark' ? 0 : -180,
                    scale: theme === 'dark' ? 1 : 0,
                    opacity: theme === 'dark' ? 1 : 0
                }}
                transition={{ duration: 0.3 }}
                className="flex items-center justify-center"
            >
                <Moon className="w-5 h-5" />
            </motion.div>

            {/* Invisible spacer to maintain width/height */}
            <div className="w-5 h-5 opacity-0"></div>
        </button>
    )
}

import React, { createContext, useContext, useState, useEffect } from 'react'

const ThemeContext = createContext()

export function useTheme() {
    return useContext(ThemeContext)
}

export function ThemeProvider({ children }) {
    // Initialize theme from localStorage or system preference
    const [theme, setTheme] = useState(() => {
        const savedTheme = localStorage.getItem('theme')
        if (savedTheme) {
            return savedTheme
        }
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    })

    useEffect(() => {
        const root = window.document.documentElement

        // Remove previous class
        root.classList.remove('light', 'dark')

        // Add new class
        root.classList.add(theme)

        // Save to localStorage
        localStorage.setItem('theme', theme)
    }, [theme])

    const toggleTheme = () => {
        setTheme(prev => prev === 'light' ? 'dark' : 'light')
    }

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    )
}

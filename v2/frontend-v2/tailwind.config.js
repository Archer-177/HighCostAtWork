/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // FUNLHN Brand Colors
        maroon: {
          50: '#fdf4f4',
          100: '#fbe8e9',
          200: '#f6d5d7',
          300: '#edb3b7',
          400: '#e28891',
          500: '#d05f6c',
          600: '#b93f51',
          700: '#8A2A2B', // Primary brand color
          800: '#7f2a35',
          900: '#6e2732',
        },
        ochre: {
          50: '#fef8f3',
          100: '#fceee3',
          200: '#f9dbc6',
          300: '#f5c09e',
          400: '#ee9a6c',
          500: '#D97B5A', // Secondary brand color
          600: '#d65f39',
          700: '#b94a2b',
          800: '#943c26',
          900: '#773323',
        },
        sand: {
          50: '#FAF5F0', // Background color
          100: '#f5ede2',
          200: '#ead9c5',
          300: '#ddc19f',
          400: '#cca077',
          500: '#bb845a',
          600: '#a96d4d',
          700: '#8c5841',
          800: '#714939',
          900: '#5c3d31',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Poppins', 'sans-serif'],
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: 0 },
          '100%': { transform: 'translateY(0)', opacity: 1 },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: 0 },
          '100%': { transform: 'translateY(0)', opacity: 1 },
        },
      },
      boxShadow: {
        'glow': '0 0 20px rgba(138, 42, 43, 0.3)',
        'glow-ochre': '0 0 20px rgba(217, 123, 90, 0.3)',
      },
    },
  },
  plugins: [],
}

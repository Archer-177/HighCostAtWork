/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        maroon: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#8A2A2B',
          900: '#7f1d1d',
        },
        ochre: {
          50: '#fef6ee',
          100: '#fde8d5',
          200: '#faccab',
          300: '#f7a876',
          400: '#f37b3e',
          500: '#D97B5A',
          600: '#de5117',
          700: '#b83a0f',
          800: '#932f13',
          900: '#792813',
        },
        sand: {
          50: '#FAF5F0',
          100: '#f7f2ed',
          200: '#ede4db',
          300: '#dfd0bf',
          400: '#ceb39f',
          500: '#bd9782',
          600: '#b0816a',
          700: '#936a56',
          800: '#78584a',
          900: '#634a3f',
        }
      },
      fontFamily: {
        'display': ['Bebas Neue', 'sans-serif'],
        'body': ['Figtree', 'sans-serif'],
        'mono': ['JetBrains Mono', 'monospace']
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'gradient': 'gradient 8s ease infinite',
        'scan': 'scan 2s ease-in-out infinite',
        'alert-pulse': 'alert-pulse 2s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        gradient: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        scan: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(100%)' },
        },
        'alert-pulse': {
          '0%, 100%': { 
            opacity: '1',
            transform: 'scale(1)',
          },
          '50%': { 
            opacity: '0.7',
            transform: 'scale(1.05)',
          },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'noise': 'url("data:image/svg+xml,%3Csvg width="100" height="100" xmlns="http://www.w3.org/2000/svg"%3E%3Cfilter id="noiseFilter"%3E%3CfeTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" stitchTiles="stitch"/%3E%3C/filter%3E%3Crect width="100%25" height="100%25" filter="url(%23noiseFilter)" opacity="0.03"/%3E%3C/svg%3E")',
      },
    },
  },
  plugins: [],
}

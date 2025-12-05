import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  LayoutDashboard, Package, TruckIcon, FileText, Settings,
  LogOut, Heart, ChevronRight, Pill, Building2, MapPin
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import ThemeToggle from './ThemeToggle'

export default function Navigation() {
  const navigate = useNavigate()
  const { user, logout, canReceiveStock, canTransferStock, canViewReports, canManageSettings, canViewStockLevels } = useAuth()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const navItems = [
    {
      path: '/',
      label: 'Dashboard',
      icon: LayoutDashboard,
      show: true
    },
    {
      path: '/receive',
      label: 'Receive Stock',
      icon: Package,
      show: canReceiveStock
    },
    {
      path: '/transfer',
      label: 'Transfer Stock',
      icon: TruckIcon,
      show: canTransferStock
    },
    {
      path: '/journey',
      label: 'Stock Journey',
      icon: MapPin,
      show: true
    },
    {
      path: '/reports',
      label: 'Reports',
      icon: FileText,
      show: canViewReports
    },
    {
      path: '/stock-levels',
      label: 'Min Stock Levels',
      icon: Package,
      show: canViewStockLevels
    },
    {
      path: '/settings',
      label: 'Settings',
      icon: Settings,
      show: canManageSettings
    },
  ]

  const locationIcon = {
    'HUB': Building2,
    'WARD': Heart,
    'REMOTE': MapPin
  }

  const LocationIcon = locationIcon[user?.location_type] || Building2

  return (
    <nav className="fixed left-0 top-0 w-64 h-full bg-gradient-to-b from-gray-900 to-gray-950 text-white z-40">
      <div className="p-6">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-maroon-500 to-maroon-700 rounded-xl 
                          flex items-center justify-center shadow-lg">
              <Pill className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="font-display text-2xl tracking-wider">FUNLHN</h2>
              <p className="text-xs text-gray-400">Medicine Tracker</p>
            </div>
          </div>

          {/* User Info */}
          <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <LocationIcon className="w-4 h-4 text-ochre-400 flex-shrink-0" />
                <p className="text-sm font-medium truncate">{user?.location_name}</p>
              </div>
              <p className="text-xs text-gray-400 truncate">
                {user?.username} • {user?.role.replace('_', ' ')}
              </p>
            </div>
            <ThemeToggle />
          </div>
        </motion.div>

        {/* Navigation Items */}
        <div className="space-y-1">
          {navItems.filter(item => item.show).map((item, index) => (
            <motion.div
              key={item.path}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <NavLink
                to={item.path}
                className={({ isActive }) => `
                  relative flex items-center gap-3 px-4 py-3 rounded-lg transition-all group
                  ${isActive
                    ? 'bg-gradient-to-r from-maroon-600 to-maroon-700 text-white shadow-lg'
                    : 'hover:bg-gray-800/50 text-gray-300 hover:text-white'
                  }
                `}
              >
                {({ isActive }) => (
                  <>
                    <item.icon className="w-5 h-5" />
                    <span className="font-medium">{item.label}</span>
                    {isActive && (
                      <motion.div
                        layoutId="nav-indicator"
                        className="absolute right-2"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </motion.div>
                    )}
                  </>
                )}
              </NavLink>
            </motion.div>
          ))}
        </div>

        {/* Logout Button */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          onClick={handleLogout}
          className="absolute bottom-6 left-6 right-6 flex items-center gap-3 px-4 py-3 
                   bg-red-900/20 hover:bg-red-900/30 text-red-400 hover:text-red-300
                   rounded-lg transition-all group"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Logout</span>
        </motion.button>
      </div>

      {/* Decorative Elements */}
      <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-maroon-900/20 to-transparent pointer-events-none" />
      <div className="absolute top-1/2 right-0 w-px h-32 bg-gradient-to-b from-transparent via-maroon-500/20 to-transparent" />
    </nav>
  )
}

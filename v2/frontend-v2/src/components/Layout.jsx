import { Outlet, NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Package,
  TruckIcon,
  FileBarChart,
  Settings as SettingsIcon,
  LogOut,
  Moon,
  Sun,
  Menu,
  X
} from 'lucide-react'
import useAuthStore from '../store/authStore'
import useUIStore from '../store/uiStore'
import { useState } from 'react'

export default function Layout() {
  const { user, logout, canReceiveStock, canTransferStock, canViewReports, canManageSettings } = useAuthStore()
  const { darkMode, toggleDarkMode, sidebarCollapsed, toggleSidebar } = useUIStore()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard, show: true },
    { name: 'Receive Stock', href: '/receive', icon: Package, show: canReceiveStock() },
    { name: 'Transfers', href: '/transfer', icon: TruckIcon, show: canTransferStock() },
    { name: 'Reports', href: '/reports', icon: FileBarChart, show: canViewReports() },
    { name: 'Settings', href: '/settings', icon: SettingsIcon, show: canManageSettings() },
  ].filter(item => item.show)

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar - Desktop */}
      <aside
        className={`hidden md:flex flex-col bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 ${
          sidebarCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          {!sidebarCollapsed && (
            <h1 className="text-xl font-display font-bold gradient-text">
              Medicine Tracker
            </h1>
          )}
          <button
            onClick={toggleSidebar}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            {sidebarCollapsed ? <Menu className="w-5 h-5" /> : <X className="w-5 h-5" />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navigation.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                    isActive
                      ? 'bg-maroon-100 dark:bg-maroon-900/30 text-maroon-700 dark:text-maroon-400'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  } ${sidebarCollapsed ? 'justify-center' : ''}`
                }
                title={sidebarCollapsed ? item.name : ''}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!sidebarCollapsed && <span className="font-medium">{item.name}</span>}
              </NavLink>
            )
          })}
        </nav>

        {/* User Info & Actions */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
          {!sidebarCollapsed && (
            <div className="px-4 py-2 rounded-lg bg-gray-50 dark:bg-gray-700/50">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {user?.username}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {user?.role} • {user?.location_name}
              </p>
            </div>
          )}

          <button
            onClick={toggleDarkMode}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
            title="Toggle dark mode"
          >
            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            {!sidebarCollapsed && <span>Dark Mode</span>}
          </button>

          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-red-600 dark:text-red-400"
            title="Logout"
          >
            <LogOut className="w-5 h-5" />
            {!sidebarCollapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-sand-50 dark:bg-gray-900">
        <div className="container mx-auto px-4 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

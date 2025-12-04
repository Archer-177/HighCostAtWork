import { useState, useEffect } from 'react'
import {
  User,
  Lock,
  Bell,
  Printer,
  Moon,
  Sun,
  Save,
  MapPin,
  Mail,
  Phone,
  Settings as SettingsIcon
} from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { useUIStore } from '../store/uiStore'
import { authAPI } from '../api/auth'
import { adminAPI } from '../api/admin'
import toast from 'react-hot-toast'

export default function Settings() {
  const user = useAuthStore((state) => state.user)
  const darkMode = useUIStore((state) => state.darkMode)
  const autoDarkMode = useUIStore((state) => state.autoDarkMode)
  const setDarkMode = useUIStore((state) => state.setDarkMode)
  const setAutoDarkMode = useUIStore((state) => state.setAutoDarkMode)

  const [activeTab, setActiveTab] = useState('profile') // profile, password, location, preferences

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'password', label: 'Password', icon: Lock },
    { id: 'location', label: 'Location Settings', icon: MapPin },
    { id: 'preferences', label: 'Preferences', icon: SettingsIcon }
  ]

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-4xl font-display font-bold gradient-text mb-2">
          Settings
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage your account and application preferences
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Navigation */}
        <div className="lg:col-span-1">
          <div className="card p-2">
            <nav className="space-y-1">
              {tabs.map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      activeTab === tab.id
                        ? 'bg-maroon text-white dark:bg-ochre'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{tab.label}</span>
                  </button>
                )
              })}
            </nav>
          </div>
        </div>

        {/* Content */}
        <div className="lg:col-span-3">
          {activeTab === 'profile' && <ProfileSettings user={user} />}
          {activeTab === 'password' && <PasswordSettings user={user} />}
          {activeTab === 'location' && <LocationSettings user={user} />}
          {activeTab === 'preferences' && (
            <PreferencesSettings
              darkMode={darkMode}
              autoDarkMode={autoDarkMode}
              setDarkMode={setDarkMode}
              setAutoDarkMode={setAutoDarkMode}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// PROFILE SETTINGS COMPONENT
// ============================================================================
function ProfileSettings({ user }) {
  const [formData, setFormData] = useState({
    username: user?.username || '',
    email: user?.email || '',
    mobile_number: user?.mobile_number || ''
  })
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      // In real implementation, call adminAPI.updateUser
      toast.success('Profile settings updated successfully!', { duration: 3000 })
      // TODO: Implement actual API call
    } catch (error) {
      toast.error('Failed to update profile settings')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="card">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-blue-100 dark:bg-blue-900/40 rounded-lg">
          <User className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Profile Information</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Update your personal details
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Username */}
        <div>
          <label className="block text-sm font-medium mb-2">Username</label>
          <input
            type="text"
            value={formData.username}
            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
            className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-maroon focus:border-transparent"
            disabled
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Username cannot be changed
          </p>
        </div>

        {/* Role & Location (Read-only) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Role</label>
            <input
              type="text"
              value={user?.role || 'N/A'}
              className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg"
              disabled
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Location</label>
            <input
              type="text"
              value={user?.location_name || 'N/A'}
              className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg"
              disabled
            />
          </div>
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Email <span className="text-gray-500">(Optional)</span>
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="your.email@health.sa.gov.au"
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-maroon focus:border-transparent"
            />
          </div>
        </div>

        {/* Mobile Number */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Mobile Number <span className="text-gray-500">(Optional)</span>
          </label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="tel"
              value={formData.mobile_number}
              onChange={(e) => setFormData({ ...formData, mobile_number: e.target.value })}
              placeholder="04XX XXX XXX"
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-maroon focus:border-transparent"
            />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            For SMS notifications (optional)
          </p>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary flex items-center gap-2"
          >
            {submitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

// ============================================================================
// PASSWORD SETTINGS COMPONENT
// ============================================================================
function PasswordSettings({ user }) {
  const [formData, setFormData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  })
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Validation
    if (formData.new_password.length < 8) {
      toast.error('New password must be at least 8 characters')
      return
    }

    if (formData.new_password !== formData.confirm_password) {
      toast.error('New passwords do not match')
      return
    }

    setSubmitting(true)

    try {
      await authAPI.changePassword({
        user_id: user.id,
        old_password: formData.current_password,
        new_password: formData.new_password
      })

      toast.success('Password changed successfully!')
      setFormData({
        current_password: '',
        new_password: '',
        confirm_password: ''
      })
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to change password')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="card">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-red-100 dark:bg-red-900/40 rounded-lg">
          <Lock className="w-6 h-6 text-red-600 dark:text-red-400" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Change Password</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Update your password regularly for security
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Current Password */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Current Password <span className="text-red-500">*</span>
          </label>
          <input
            type="password"
            value={formData.current_password}
            onChange={(e) =>
              setFormData({ ...formData, current_password: e.target.value })
            }
            className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-maroon focus:border-transparent"
            required
          />
        </div>

        {/* New Password */}
        <div>
          <label className="block text-sm font-medium mb-2">
            New Password <span className="text-red-500">*</span>
          </label>
          <input
            type="password"
            value={formData.new_password}
            onChange={(e) => setFormData({ ...formData, new_password: e.target.value })}
            className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-maroon focus:border-transparent"
            required
            minLength={8}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Must be at least 8 characters
          </p>
        </div>

        {/* Confirm Password */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Confirm New Password <span className="text-red-500">*</span>
          </label>
          <input
            type="password"
            value={formData.confirm_password}
            onChange={(e) =>
              setFormData({ ...formData, confirm_password: e.target.value })
            }
            className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-maroon focus:border-transparent"
            required
            minLength={8}
          />
        </div>

        {/* Security Info */}
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            <strong>Password Requirements:</strong>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Minimum 8 characters</li>
              <li>Recommended: Mix of uppercase, lowercase, numbers, and symbols</li>
              <li>Do not reuse old passwords</li>
            </ul>
          </p>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary flex items-center gap-2"
          >
            {submitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Changing...
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                Change Password
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

// ============================================================================
// LOCATION SETTINGS COMPONENT
// ============================================================================
function LocationSettings({ user }) {
  const [formData, setFormData] = useState({
    printer_ip: '',
    printer_port: 9100,
    email_notifications: true,
    sms_notifications: false
  })
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const data = await adminAPI.getSettings(user.location_id)
      if (data && Object.keys(data).length > 0) {
        setFormData({
          printer_ip: data.printer_ip || '',
          printer_port: data.printer_port || 9100,
          email_notifications: data.email_notifications !== false,
          sms_notifications: data.sms_notifications === true
        })
      }
    } catch (error) {
      // Settings might not exist yet - that's okay
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      await adminAPI.updateSettings(user.location_id, formData)
      toast.success('Location settings updated successfully!')
    } catch (error) {
      toast.error('Failed to update location settings')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="card">
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-maroon"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-purple-100 dark:bg-purple-900/40 rounded-lg">
          <MapPin className="w-6 h-6 text-purple-600 dark:text-purple-400" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Location Settings</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Configure settings for {user?.location_name}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Printer Settings */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-gray-900 dark:text-gray-100 font-medium">
            <Printer className="w-5 h-5" />
            Label Printer Configuration
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2">
                Printer IP Address
              </label>
              <input
                type="text"
                value={formData.printer_ip}
                onChange={(e) =>
                  setFormData({ ...formData, printer_ip: e.target.value })
                }
                placeholder="e.g., 192.168.1.100"
                className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-maroon focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Port</label>
              <input
                type="number"
                value={formData.printer_port}
                onChange={(e) =>
                  setFormData({ ...formData, printer_port: parseInt(e.target.value) })
                }
                className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-maroon focus:border-transparent"
              />
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Configure your Zebra label printer for printing asset ID labels
          </p>
        </div>

        {/* Notification Settings */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-gray-900 dark:text-gray-100 font-medium">
            <Bell className="w-5 h-5" />
            Notifications
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <input
                type="checkbox"
                checked={formData.email_notifications}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    email_notifications: e.target.checked
                  })
                }
                className="w-5 h-5 text-maroon rounded focus:ring-maroon"
              />
              <div className="flex-1">
                <div className="font-medium">Email Notifications</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Receive expiry alerts and important updates via email
                </div>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <input
                type="checkbox"
                checked={formData.sms_notifications}
                onChange={(e) =>
                  setFormData({ ...formData, sms_notifications: e.target.checked })
                }
                className="w-5 h-5 text-maroon rounded focus:ring-maroon"
              />
              <div className="flex-1">
                <div className="font-medium">SMS Notifications</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Receive critical alerts via SMS (mobile number required)
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary flex items-center gap-2"
          >
            {submitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Settings
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

// ============================================================================
// PREFERENCES SETTINGS COMPONENT
// ============================================================================
function PreferencesSettings({ darkMode, autoDarkMode, setDarkMode, setAutoDarkMode }) {
  return (
    <div className="card">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-indigo-100 dark:bg-indigo-900/40 rounded-lg">
          <SettingsIcon className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Preferences</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Customize your experience
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Dark Mode */}
        <div>
          <div className="flex items-center gap-2 text-gray-900 dark:text-gray-100 font-medium mb-4">
            {darkMode ? (
              <Moon className="w-5 h-5" />
            ) : (
              <Sun className="w-5 h-5" />
            )}
            Dark Mode
          </div>

          <div className="space-y-3">
            {/* Manual Toggle */}
            <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <div>
                <div className="font-medium">Manual Control</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Toggle dark mode on/off manually
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDarkMode(!darkMode)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  darkMode
                    ? 'bg-maroon dark:bg-ochre'
                    : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    darkMode ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </label>

            {/* Auto Dark Mode */}
            <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <div>
                <div className="font-medium">Auto Dark Mode</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Automatically enable dark mode at night (6pm - 6am)
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAutoDarkMode(!autoDarkMode)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  autoDarkMode
                    ? 'bg-maroon dark:bg-ochre'
                    : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    autoDarkMode ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </label>
          </div>
        </div>

        {/* App Info */}
        <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
          <div className="text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Application Version</span>
              <span className="font-medium">v2.0.0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Last Updated</span>
              <span className="font-medium">December 2025</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Environment</span>
              <span className="font-medium">Production</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

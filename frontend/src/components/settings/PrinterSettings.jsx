import React, { useState, useEffect } from 'react';
import { Printer } from 'lucide-react';
import useAppStore from '../../stores/appStore';
import { useNotification } from '../../contexts/NotificationContext';

export default function PrinterSettings() {
  const user = useAppStore((state) => state.user);
  const { success, error: showError } = useNotification();
  const [settings, setSettings] = useState({
    printer_ip: '',
    printer_port: '9100',
    label_width: 50,
    label_height: 25,
    margin_top: 0,
    margin_right: 0
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user?.location_id) {
      fetchSettings()
    }
  }, [user])

  const fetchSettings = async () => {
    try {
      const response = await fetch(`/api/settings?location_id=${user.location_id}`)
      if (response.ok) {
        const data = await response.json()
        setSettings({
          printer_ip: data.printer_ip || '',
          printer_port: data.printer_port || '9100',
          label_width: data.label_width || 50,
          label_height: data.label_height || 25,
          margin_top: data.margin_top || 0,
          margin_right: data.margin_right || 0
        })
      }
    } catch (err) {
      showError('Failed to load printer settings')
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...settings,
          location_id: user.location_id
        })
      })

      if (response.ok) {
        success('Settings Saved', 'Printer configuration updated successfully')
      } else {
        showError('Failed to save settings')
      }
    } catch (err) {
      showError('Connection Error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
          <Printer className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Zebra Printer Configuration</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Configure network printer for label generation</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="max-w-2xl space-y-8">
        {/* Network Settings */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 border-b dark:border-gray-700 pb-2">Network Connection</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Printer IP Address</label>
              <input
                type="text"
                value={settings.printer_ip}
                onChange={(e) => setSettings({ ...settings, printer_ip: e.target.value })}
                className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg
                         focus:outline-none focus:border-maroon-500 focus:bg-white dark:focus:bg-gray-600 transition-all dark:text-white"
                placeholder="e.g., 192.168.1.100"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Leave blank to disable printing.
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Port</label>
              <input
                type="number"
                value={settings.printer_port}
                onChange={(e) => setSettings({ ...settings, printer_port: e.target.value })}
                className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg
                         focus:outline-none focus:border-maroon-500 focus:bg-white dark:focus:bg-gray-600 transition-all dark:text-white"
                placeholder="Default: 9100"
              />
            </div>
          </div>
        </div>

        {/* Label Settings */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 border-b dark:border-gray-700 pb-2">Label Configuration</h3>


          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Label Width (mm)</label>
              <input
                type="number"
                value={settings.label_width}
                onChange={(e) => setSettings({ ...settings, label_width: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg
                         focus:outline-none focus:border-maroon-500 focus:bg-white dark:focus:bg-gray-600 transition-all dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Label Height (mm)</label>
              <input
                type="number"
                value={settings.label_height}
                onChange={(e) => setSettings({ ...settings, label_height: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg
                         focus:outline-none focus:border-maroon-500 focus:bg-white dark:focus:bg-gray-600 transition-all dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Top Margin (mm)</label>
              <input
                type="number"
                value={settings.margin_top}
                onChange={(e) => setSettings({ ...settings, margin_top: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg
                         focus:outline-none focus:border-maroon-500 focus:bg-white dark:focus:bg-gray-600 transition-all dark:text-white"
                placeholder="Offset from top"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Right Margin (mm)</label>
              <input
                type="number"
                value={settings.margin_right}
                onChange={(e) => setSettings({ ...settings, margin_right: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg
                         focus:outline-none focus:border-maroon-500 focus:bg-white dark:focus:bg-gray-600 transition-all dark:text-white"
                placeholder="Offset from right"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2 bg-maroon-600 hover:bg-maroon-700 text-white 
                   font-medium rounded-lg transition-colors flex items-center gap-2"
        >
          {loading ? 'Saving...' : 'Save Configuration'}
        </button>
      </form>
    </div>
  )
}

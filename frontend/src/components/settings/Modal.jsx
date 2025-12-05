import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNotification } from '../../contexts/NotificationContext';

export default function Modal({ type, item, locations, currentUser, onClose, onSuccess }) {
  const { success, error: showError } = useNotification()
  const [formData, setFormData] = useState({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (item) {
      setFormData(item)
    } else {
      // Initialize empty form based on type
      switch (type) {
        case 'drug':
          setFormData({ name: '', category: '', storage_temp: '<25°C', unit_price: '' })
          break
        case 'location':
          setFormData({ name: '', type: 'WARD', parent_hub_id: '' })
          break
        case 'user':
          setFormData({ username: '', password: '', role: 'NURSE', location_id: '', email: '', mobile_number: '', can_delegate: false, is_supervisor: false })
          break
      }
    }
  }, [type, item])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const endpoint = type === 'drug' ? '/api/drugs' : type === 'location' ? '/api/locations' : '/api/users'
      const method = item ? 'PUT' : 'POST'
      const url = item ? `${endpoint}/${item.id}` : endpoint

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        success(
          item ? `${type} Updated` : `${type} Created`,
          `The ${type} has been ${item ? 'updated' : 'created'} successfully`
        )
        onSuccess()
      } else {
        const data = await response.json()
        showError(`Failed to ${item ? 'update' : 'create'} ${type}`, data.error)
      }
    } catch (err) {
      showError('Connection Error', `Failed to ${item ? 'update' : 'create'} ${type}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold mb-4 dark:text-white">
          {item ? 'Edit' : 'Add'} {type.charAt(0).toUpperCase() + type.slice(1)}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          {type === 'drug' && (
            <>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg
                           focus:outline-none focus:border-maroon-500 focus:bg-white transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Category</label>
                <input
                  type="text"
                  value={formData.category || ''}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg
                           focus:outline-none focus:border-maroon-500 focus:bg-white dark:focus:bg-gray-600 transition-all dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Storage Temperature</label>
                <select
                  value={formData.storage_temp || '<25°C'}
                  onChange={(e) => setFormData({ ...formData, storage_temp: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg
                           focus:outline-none focus:border-maroon-500 focus:bg-white dark:focus:bg-gray-600 transition-all dark:text-white"
                >
                  <option value="<25°C">Shelf (&lt;25°C)</option>
                  <option value="2-8°C">Fridge (2-8°C)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Unit Price (AUD)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.unit_price || ''}
                  onChange={(e) => setFormData({ ...formData, unit_price: parseFloat(e.target.value) })}
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg
                           focus:outline-none focus:border-maroon-500 focus:bg-white dark:focus:bg-gray-600 transition-all dark:text-white"
                  required
                />
              </div>
            </>
          )}

          {type === 'location' && (
            <>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg
                           focus:outline-none focus:border-maroon-500 focus:bg-white transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Type</label>
                <select
                  value={formData.type || 'WARD'}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg
                           focus:outline-none focus:border-maroon-500 focus:bg-white dark:focus:bg-gray-600 transition-all dark:text-white"
                >
                  <option value="HUB">Hub Pharmacy</option>
                  <option value="WARD">Ward</option>
                  <option value="REMOTE">Remote Site</option>
                </select>
              </div>

              {formData.type !== 'HUB' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Parent Hub</label>
                  <select
                    value={formData.parent_hub_id || ''}
                    onChange={(e) => setFormData({ ...formData, parent_hub_id: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg
                             focus:outline-none focus:border-maroon-500 focus:bg-white dark:focus:bg-gray-600 transition-all dark:text-white"
                    required
                  >
                    <option value="">Select hub...</option>
                    {locations
                      ?.filter(l => l.type === 'HUB')
                      ?.filter(l => !currentUser?.is_supervisor || l.id === currentUser?.location_id)
                      ?.map(hub => (
                        <option key={hub.id} value={hub.id}>{hub.name}</option>
                      ))}
                  </select>
                </div>
              )}
            </>
          )}

          {type === 'user' && (
            <>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Username</label>
                <input
                  type="text"
                  value={formData.username || ''}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg
                           focus:outline-none focus:border-maroon-500 focus:bg-white dark:focus:bg-gray-600 transition-all dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Password {item && <span className="text-gray-400 font-normal">(Leave blank to keep current)</span>}
                </label>
                <input
                  type="password"
                  value={formData.password || ''}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg
                           focus:outline-none focus:border-maroon-500 focus:bg-white dark:focus:bg-gray-600 transition-all dark:text-white"
                  required={!item}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Role</label>
                <select
                  value={formData.role || 'NURSE'}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg
                           focus:outline-none focus:border-maroon-500 focus:bg-white dark:focus:bg-gray-600 transition-all dark:text-white"
                >
                  <option value="PHARMACIST">Pharmacist</option>
                  <option value="PHARMACY_TECH">Pharmacy Technician</option>
                  <option value="NURSE">Nurse</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Location</label>
                <select
                  value={formData.location_id || ''}
                  onChange={(e) => setFormData({ ...formData, location_id: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg
                           focus:outline-none focus:border-maroon-500 focus:bg-white dark:focus:bg-gray-600 transition-all dark:text-white"
                  required
                >
                  <option value="">Select location...</option>
                  {locations
                    ?.filter(l => !currentUser?.is_supervisor || (l.id === currentUser?.location_id || l.parent_hub_id === currentUser?.location_id))
                    ?.map(loc => (
                      <option key={loc.id} value={loc.id}>{loc.name}</option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg
                           focus:outline-none focus:border-maroon-500 focus:bg-white dark:focus:bg-gray-600 transition-all dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Mobile Number</label>
                <input
                  type="tel"
                  value={formData.mobile_number || ''}
                  onChange={(e) => setFormData({ ...formData, mobile_number: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg
                           focus:outline-none focus:border-maroon-500 focus:bg-white dark:focus:bg-gray-600 transition-all dark:text-white"
                  placeholder="+614..."
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="can_delegate"
                  checked={formData.can_delegate || false}
                  onChange={(e) => setFormData({ ...formData, can_delegate: e.target.checked })}
                  className="w-4 h-4 text-maroon-600 rounded border-gray-300 dark:border-gray-600 focus:ring-maroon-500 dark:bg-gray-700"
                />
                <label htmlFor="can_delegate" className="text-sm text-gray-700 dark:text-gray-300">
                  Can delegate tasks (e.g. signing)
                </label>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="is_supervisor"
                  checked={formData.is_supervisor || false}
                  onChange={(e) => setFormData({ ...formData, is_supervisor: e.target.checked })}
                  className="w-4 h-4 text-maroon-600 rounded border-gray-300 dark:border-gray-600 focus:ring-maroon-500 dark:bg-gray-700"
                />
                <label htmlFor="is_supervisor" className="text-sm text-gray-700 dark:text-gray-300">
                  Site Supervisor (Admin access for site)
                </label>
              </div>
            </>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300
                       font-medium rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2 bg-maroon-600 hover:bg-maroon-700 text-white 
                       font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Saving...' : (item ? 'Update' : 'Create')}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

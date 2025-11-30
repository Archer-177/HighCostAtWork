import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Search, Filter, Save, X, ChevronDown, ChevronRight, Building2, MapPin, Heart, Edit2, Shield, User, Trash2,
  Pill, Users, Check, AlertCircle, DollarSign, Thermometer, Hash
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useNotification } from '../contexts/NotificationContext'

export default function Settings() {
  const { user } = useAuth()
  const { success, error: showError } = useNotification()

  const [activeTab, setActiveTab] = useState('drugs')
  const [drugs, setDrugs] = useState([])
  const [locations, setLocations] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [modalType, setModalType] = useState('')
  const [editItem, setEditItem] = useState(null)
  const [deleteModal, setDeleteModal] = useState({ show: false, type: '', item: null })

  useEffect(() => {
    fetchData()
  }, [activeTab])

  const fetchData = async () => {
    setLoading(true)
    try {
      // Add timestamp to prevent caching
      const timestamp = new Date().getTime()

      if (activeTab === 'users') {
        const [usersRes, locationsRes] = await Promise.all([
          fetch(`/api/users?t=${timestamp}`),
          fetch(`/api/locations?t=${timestamp}`)
        ])

        if (usersRes.ok && locationsRes.ok) {
          setUsers(await usersRes.json())
          setLocations(await locationsRes.json())
        }
      } else {
        let endpoint = ''
        switch (activeTab) {
          case 'drugs':
            endpoint = '/api/drugs'
            break
          case 'locations':
            endpoint = '/api/locations'
            break
        }

        if (endpoint) {
          const response = await fetch(`${endpoint}?t=${timestamp}`)
          const data = await response.json()

          if (response.ok) {
            if (activeTab === 'drugs') setDrugs(data)
            if (activeTab === 'locations') setLocations(data)
          }
        }
      }
    } catch (err) {
      showError('Failed to load data')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenModal = (type, item = null) => {
    setModalType(type)
    setEditItem(item)
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditItem(null)
    setModalType('')
  }

  const handleDeleteRequest = (type, item) => {
    setDeleteModal({ show: true, type, item })
  }

  const handleConfirmDelete = async () => {
    const { type, item } = deleteModal
    if (!item) return

    try {
      const endpoint = type === 'drug' ? `/api/drugs/${item.id}`
        : type === 'location' ? `/api/locations/${item.id}`
          : `/api/users/${item.id}`

      const response = await fetch(endpoint, { method: 'DELETE' })

      if (response.ok) {
        success(`${type.charAt(0).toUpperCase() + type.slice(1)} Deleted`, 'Item has been removed successfully')
        setDeleteModal({ show: false, type: '', item: null })
        fetchData()
      } else {
        const data = await response.json()
        showError('Delete Failed', data.error || 'Could not delete item')
        setDeleteModal({ show: false, type: '', item: null }) // Close modal on error too? Or keep open? Better close and show error.
      }
    } catch (err) {
      showError('Delete Failed', 'An error occurred while deleting')
      setDeleteModal({ show: false, type: '', item: null })
    }
  }

  const tabs = [
    { id: 'drugs', label: 'Medicine Catalogue', icon: Pill },
    { id: 'locations', label: 'Locations', icon: MapPin },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'security', label: 'Security', icon: Shield }
  ]

  return (
    <div className="min-h-screen p-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-4xl font-display tracking-wider gradient-text mb-2">
          System Settings
        </h1>
        <p className="text-gray-600">
          Manage medicines, locations, users, and system configuration
        </p>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {tabs.map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${activeTab === tab.id
                ? 'bg-maroon-600 text-white shadow-lg'
                : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="spinner" />
          </div>
        ) : (
          <>
            {activeTab === 'drugs' && (
              <motion.div
                key="drugs"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <DrugsCatalogue
                  drugs={drugs}
                  onAdd={() => handleOpenModal('drug')}
                  onEdit={(drug) => handleOpenModal('drug', drug)}
                  onDelete={(drug) => handleDeleteRequest('drug', drug)}
                />
              </motion.div>
            )}

            {activeTab === 'locations' && (
              <motion.div
                key="locations"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <LocationsManagement
                  locations={locations}
                  onAdd={() => handleOpenModal('location')}
                  onEdit={(location) => handleOpenModal('location', location)}
                  onDelete={(location) => handleDeleteRequest('location', location)}
                />
              </motion.div>
            )}

            {activeTab === 'users' && (
              <motion.div
                key="users"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <UsersManagement
                  users={users}
                  onAdd={() => handleOpenModal('user')}
                  onEdit={(user) => handleOpenModal('user', user)}
                  onDelete={(user) => handleDeleteRequest('user', user)}
                />
              </motion.div>
            )}

            {activeTab === 'security' && (
              <motion.div
                key="security"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <SecuritySettings user={user} />
              </motion.div>
            )}
          </>
        )}
      </AnimatePresence>

      {/* Modal */}
      {showModal && (
        <Modal
          type={modalType}
          item={editItem}
          locations={locations}
          onClose={handleCloseModal}
          onSuccess={() => {
            handleCloseModal()
            fetchData()
          }}
        />
      )}

      {/* Confirmation Modal */}
      {deleteModal.show && (
        <ConfirmationModal
          isOpen={deleteModal.show}
          title={`Delete ${deleteModal.type.charAt(0).toUpperCase() + deleteModal.type.slice(1)}`}
          message={`Are you sure you want to delete ${deleteModal.type === 'user' ? deleteModal.item.username : deleteModal.item.name}? This action cannot be undone.`}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteModal({ show: false, type: '', item: null })}
        />
      )}
    </div>
  )
}

// Drugs Catalogue Component
function DrugsCatalogue({ drugs, onAdd, onEdit, onDelete }) {
  const { success, error: showError } = useNotification()

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
      <div className="p-6 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-xl font-bold">Medicine Catalogue</h2>
        <button
          onClick={onAdd}
          className="px-4 py-2 bg-maroon-600 hover:bg-maroon-700 text-white 
                   font-medium rounded-lg transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Medicine
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-6 font-semibold text-gray-700">Name</th>
              <th className="text-left py-3 px-6 font-semibold text-gray-700">Category</th>
              <th className="text-left py-3 px-6 font-semibold text-gray-700">Storage</th>
              <th className="text-right py-3 px-6 font-semibold text-gray-700">Unit Price</th>
              <th className="text-right py-3 px-6 font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {drugs.map(drug => (
              <tr key={drug.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-6 font-medium">{drug.name}</td>
                <td className="py-3 px-6">{drug.category}</td>
                <td className="py-3 px-6">
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${drug.storage_temp?.includes('2-8')
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-orange-100 text-orange-700'
                    }`}>
                    <Thermometer className="w-3 h-3" />
                    {drug.storage_temp}
                  </span>
                </td>
                <td className="text-right py-3 px-6 font-mono">
                  ${drug.unit_price.toFixed(2)}
                </td>
                <td className="text-right py-3 px-6">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => onEdit(drug)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-4 h-4 text-gray-600" />
                    </button>
                    <button
                      onClick={() => onDelete(drug)}
                      className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Locations Management Component
function LocationsManagement({ locations, onAdd, onEdit, onDelete }) {
  const { success, error: showError } = useNotification()

  const locationIcon = {
    'HUB': Building2,
    'WARD': Heart,
    'REMOTE': MapPin
  }

  const handleSetMinStock = async (locationId, drugId, minStock) => {
    try {
      const response = await fetch('/api/stock_levels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location_id: locationId, drug_id: drugId, min_stock: minStock })
      })

      if (response.ok) {
        success('Min Stock Updated', 'Minimum stock level has been set')
      }
    } catch (err) {
      showError('Failed to update stock level')
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
      <div className="p-6 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-xl font-bold">Locations</h2>
        <button
          onClick={onAdd}
          className="px-4 py-2 bg-maroon-600 hover:bg-maroon-700 text-white 
                   font-medium rounded-lg transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Location
        </button>
      </div>

      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        {locations.map(location => {
          const Icon = locationIcon[location.type]
          return (
            <motion.div
              key={location.id}
              whileHover={{ scale: 1.02 }}
              className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${location.type === 'HUB' ? 'bg-maroon-100' :
                    location.type === 'WARD' ? 'bg-ochre-100' : 'bg-blue-100'
                    }`}>
                    <Icon className={`w-5 h-5 ${location.type === 'HUB' ? 'text-maroon-600' :
                      location.type === 'WARD' ? 'text-ochre-600' : 'text-blue-600'
                      }`} />
                  </div>
                  <div>
                    <h3 className="font-semibold">{location.name}</h3>
                    <p className="text-sm text-gray-600">{location.type}</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => onEdit(location)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Edit Location"
                  >
                    <Edit2 className="w-4 h-4 text-gray-600" />
                  </button>
                  <button
                    onClick={() => onDelete(location)}
                    className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete Location"
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </button>
                </div>
              </div>

              {location.parent_hub_id && (
                <p className="text-sm text-gray-600">
                  Parent Hub: {locations.find(l => l.id === location.parent_hub_id)?.name}
                </p>
              )}
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

// Users Management Component
function UsersManagement({ users, onAdd, onEdit, onDelete }) {
  const roleColors = {
    'PHARMACIST': 'bg-purple-100 text-purple-700',
    'PHARMACY_TECH': 'bg-blue-100 text-blue-700',
    'NURSE': 'bg-green-100 text-green-700'
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
      <div className="p-6 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-xl font-bold">Users</h2>
        <button
          onClick={onAdd}
          className="px-4 py-2 bg-maroon-600 hover:bg-maroon-700 text-white 
                   font-medium rounded-lg transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add User
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-6 font-semibold text-gray-700">Username</th>
              <th className="text-left py-3 px-6 font-semibold text-gray-700">Role</th>
              <th className="text-left py-3 px-6 font-semibold text-gray-700">Location</th>
              <th className="text-left py-3 px-6 font-semibold text-gray-700">Email</th>
              <th className="text-center py-3 px-6 font-semibold text-gray-700">Can Delegate</th>
              <th className="text-right py-3 px-6 font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-6 font-medium">{user.username}</td>
                <td className="py-3 px-6">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${roleColors[user.role]}`}>
                    {user.role.replace('_', ' ')}
                  </span>
                </td>
                <td className="py-3 px-6">{user.location_name}</td>
                <td className="py-3 px-6">{user.email || '-'}</td>
                <td className="text-center py-3 px-6">
                  {user.can_delegate ? (
                    <Check className="w-5 h-5 text-green-600 mx-auto" />
                  ) : (
                    <X className="w-5 h-5 text-gray-300 mx-auto" />
                  )}
                </td>
                <td className="text-right py-3 px-6">
                  <div className="flex gap-2">
                    <button
                      onClick={() => onEdit(user)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Edit User"
                    >
                      <Edit2 className="w-4 h-4 text-gray-600" />
                    </button>
                    <button
                      onClick={() => onDelete(user)}
                      className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete User"
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Security Settings Component
function SecuritySettings({ user }) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-xl font-bold mb-6">Security Settings</h2>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium">Session Timeout</p>
              <p className="text-sm text-gray-600">Automatic logout after inactivity</p>
            </div>
            <span className="font-mono font-medium">15 minutes</span>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium">Password Requirements</p>
              <p className="text-sm text-gray-600">Minimum 8 characters, mixed case</p>
            </div>
            <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-sm font-medium">
              Enforced
            </span>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium">Audit Logging</p>
              <p className="text-sm text-gray-600">Track all user actions</p>
            </div>
            <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-sm font-medium">
              Enabled
            </span>
          </div>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-900 mb-2">Security Notice</p>
            <p className="text-sm text-amber-800">
              This application runs on a shared network drive with file-based authentication.
              For enhanced security, ensure the network drive has appropriate access controls
              and regular backups are maintained.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// Confirmation Modal
function ConfirmationModal({ isOpen, title, message, onConfirm, onCancel }) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
      >
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900">{title}</h3>
          </div>

          <p className="text-gray-600 mb-8">
            {message}
          </p>

          <div className="flex gap-3 justify-end">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-50 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

// Modal Component
function Modal({ type, item, locations, onClose, onSuccess }) {
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
          setFormData({ username: '', password: '', role: 'NURSE', location_id: '', email: '', can_delegate: false })
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
        className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold mb-4">
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
                <label className="block text-sm font-semibold text-gray-700 mb-1">Category</label>
                <input
                  type="text"
                  value={formData.category || ''}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg
                           focus:outline-none focus:border-maroon-500 focus:bg-white transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Storage Temperature</label>
                <select
                  value={formData.storage_temp || '<25°C'}
                  onChange={(e) => setFormData({ ...formData, storage_temp: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg
                           focus:outline-none focus:border-maroon-500 focus:bg-white transition-all"
                >
                  <option value="<25°C">Shelf (&lt;25°C)</option>
                  <option value="2-8°C">Fridge (2-8°C)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Unit Price (AUD)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.unit_price || ''}
                  onChange={(e) => setFormData({ ...formData, unit_price: parseFloat(e.target.value) })}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg
                           focus:outline-none focus:border-maroon-500 focus:bg-white transition-all"
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
                <label className="block text-sm font-semibold text-gray-700 mb-1">Type</label>
                <select
                  value={formData.type || 'WARD'}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg
                           focus:outline-none focus:border-maroon-500 focus:bg-white transition-all"
                >
                  <option value="HUB">Hub Pharmacy</option>
                  <option value="WARD">Ward</option>
                  <option value="REMOTE">Remote Site</option>
                </select>
              </div>

              {formData.type !== 'HUB' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Parent Hub</label>
                  <select
                    value={formData.parent_hub_id || ''}
                    onChange={(e) => setFormData({ ...formData, parent_hub_id: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg
                             focus:outline-none focus:border-maroon-500 focus:bg-white transition-all"
                    required
                  >
                    <option value="">Select hub...</option>
                    <option value="1">Port Augusta Hospital Pharmacy</option>
                    <option value="2">Whyalla Hospital Pharmacy</option>
                  </select>
                </div>
              )}
            </>
          )}

          {type === 'user' && (
            <>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Username</label>
                <input
                  type="text"
                  value={formData.username || ''}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg
                           focus:outline-none focus:border-maroon-500 focus:bg-white transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Password {item && <span className="text-gray-400 font-normal">(Leave blank to keep current)</span>}
                </label>
                <input
                  type="password"
                  value={formData.password || ''}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg
                           focus:outline-none focus:border-maroon-500 focus:bg-white transition-all"
                  required={!item}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Role</label>
                <select
                  value={formData.role || 'NURSE'}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg
                           focus:outline-none focus:border-maroon-500 focus:bg-white transition-all"
                >
                  <option value="PHARMACIST">Pharmacist</option>
                  <option value="PHARMACY_TECH">Pharmacy Technician</option>
                  <option value="NURSE">Nurse</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Location</label>
                <select
                  value={formData.location_id || ''}
                  onChange={(e) => setFormData({ ...formData, location_id: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg
                           focus:outline-none focus:border-maroon-500 focus:bg-white transition-all"
                  required
                >
                  <option value="">Select location...</option>
                  {locations?.map(loc => (
                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg
                           focus:outline-none focus:border-maroon-500 focus:bg-white transition-all"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="can_delegate"
                  checked={formData.can_delegate || false}
                  onChange={(e) => setFormData({ ...formData, can_delegate: e.target.checked })}
                  className="w-4 h-4 text-maroon-600 rounded border-gray-300 focus:ring-maroon-500"
                />
                <label htmlFor="can_delegate" className="text-sm text-gray-700">
                  Can delegate tasks (e.g. signing)
                </label>
              </div>
            </>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 
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

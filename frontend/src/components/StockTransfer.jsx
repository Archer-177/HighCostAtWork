import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  TruckIcon, MapPin, Package, ArrowRight, Clock,
  CheckCircle, XCircle, AlertTriangle, Search, Filter,
  Building2, Heart, Users
} from 'lucide-react'
import { format } from 'date-fns'
import { useAuth } from '../contexts/AuthContext'
import { useNotification } from '../contexts/NotificationContext'
import NetworkMap from './NetworkMap'

export default function StockTransfer() {
  const { user, isPharmacist } = useAuth()
  const { success, error: showError } = useNotification()

  const [activeTab, setActiveTab] = useState('create')
  const [locations, setLocations] = useState([])
  const [availableStock, setAvailableStock] = useState([])
  const [selectedItems, setSelectedItems] = useState([])
  const [fromLocation, setFromLocation] = useState('')
  const [toLocation, setToLocation] = useState('')
  const [transfers, setTransfers] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchLocations()
    fetchTransfers()
  }, [])

  useEffect(() => {
    if (user && user.location_id && !fromLocation) {
      // Default to user's location if it's a valid source (Hub or Ward)
      // We cast to string because select values are strings
      setFromLocation(user.location_id.toString())
    }
  }, [user])

  useEffect(() => {
    if (fromLocation) {
      fetchAvailableStock(fromLocation)
    }
  }, [fromLocation])

  const fetchLocations = async () => {
    try {
      const response = await fetch('/api/locations')
      const data = await response.json()
      if (response.ok) {
        setLocations(data)
      }
    } catch (err) {
      showError('Failed to load locations')
    }
  }

  const fetchAvailableStock = async (locationId) => {
    try {
      const response = await fetch(`/api/stock/${locationId}`)
      const data = await response.json()
      if (response.ok) {
        setAvailableStock(data)
      }
    } catch (err) {
      showError('Failed to load stock')
    }
  }

  const fetchTransfers = async () => {
    try {
      const response = await fetch(`/api/transfers/${user.location_id}`)
      const data = await response.json()
      if (response.ok) {
        setTransfers(data)
      }
    } catch (err) {
      showError('Failed to load transfers')
    }
  }

  const handleCreateTransfer = async () => {
    if (!fromLocation || !toLocation || selectedItems.length === 0) {
      showError('Validation Error', 'Please select locations and items to transfer')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/create_transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from_location_id: parseInt(fromLocation),
          to_location_id: parseInt(toLocation),
          vial_ids: selectedItems,
          created_by: user.id
        })
      })

      const data = await response.json()

      if (response.ok) {
        success(
          'Transfer Created',
          data.needs_approval
            ? 'Transfer requires approval from Whyalla pharmacist'
            : 'Transfer initiated successfully'
        )

        // Reset form
        setSelectedItems([])
        setFromLocation('')
        setToLocation('')
        fetchTransfers()
        setActiveTab('pending')
      } else {
        showError('Failed to create transfer', data.error)
      }
    } catch (err) {
      showError('Connection Error', 'Failed to create transfer')
    } finally {
      setLoading(false)
    }
  }

  const toggleItemSelection = (itemId) => {
    setSelectedItems(prev =>
      prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    )
  }

  const filteredStock = availableStock.filter(item =>
    item.drug_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.asset_id.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const locationIcon = {
    'HUB': Building2,
    'WARD': Heart,
    'REMOTE': MapPin
  }

  return (
    <div className="min-h-screen p-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-4xl font-display tracking-wider gradient-text mb-2">
          Stock Transfer
        </h1>
        <p className="text-gray-600">
          Move medicines between locations for optimal distribution
        </p>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setActiveTab('create')}
          className={`px-6 py-3 rounded-xl font-medium transition-all ${activeTab === 'create'
            ? 'bg-maroon-600 text-white shadow-lg'
            : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
        >
          Create Transfer
        </button>
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-6 py-3 rounded-xl font-medium transition-all relative ${activeTab === 'pending'
            ? 'bg-maroon-600 text-white shadow-lg'
            : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
        >
          Pending Transfers
          {transfers.filter(t => t.status === 'PENDING').length > 0 && (
            <span className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white text-xs 
                           font-bold rounded-full flex items-center justify-center">
              {transfers.filter(t => t.status === 'PENDING').length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-6 py-3 rounded-xl font-medium transition-all ${activeTab === 'history'
            ? 'bg-maroon-600 text-white shadow-lg'
            : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
        >
          Transfer History
        </button>
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'create' && (
          <motion.div
            key="create"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            {/* Interactive Network Map - Full Width, Primary Interaction */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold">Select Locations</h3>
                  <p className="text-sm text-gray-600 mt-1">Click locations on the map to select source and destination</p>
                </div>

                {/* Selection Status Indicator */}
                {fromLocation && (
                  <div className="flex items-center gap-3 text-sm">
                    <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg">
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                      <span className="font-medium text-blue-900">
                        {locations.find(l => l.id.toString() === fromLocation)?.name || 'Source selected'}
                      </span>
                    </div>
                    {toLocation && (
                      <>
                        <ArrowRight className="w-4 h-4 text-gray-400" />
                        <div className="flex items-center gap-2 px-3 py-2 bg-maroon-50 rounded-lg">
                          <div className="w-2 h-2 rounded-full bg-maroon-600" />
                          <span className="font-medium text-maroon-900">
                            {locations.find(l => l.id.toString() === toLocation)?.name || 'Destination selected'}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Network Map */}
              <NetworkMap
                onSelectLocation={(id) => {
                  const locId = id.toString()

                  // Smart Selection Logic
                  if (!fromLocation || (fromLocation && toLocation)) {
                    // First click or reset: Select Source
                    // Allow deselection if clicking the same location
                    if (fromLocation === locId) {
                      setFromLocation('')
                      setToLocation('')
                      setSelectedItems([])
                    } else {
                      setFromLocation(locId)
                      setToLocation('')
                      setSelectedItems([])
                    }
                  } else if (fromLocation && !toLocation) {
                    // Second click: Select Destination
                    if (locId === fromLocation) {
                      // Deselect if clicking source again
                      setFromLocation('')
                      return
                    }

                    // Validation is now visual (disabled nodes), so we just set it
                    // Double check validity just in case
                    const source = locations.find(l => l.id.toString() === fromLocation)
                    const target = locations.find(l => l.id.toString() === locId)

                    if (source && target) {
                      setToLocation(locId)
                    }
                  }
                }}
                fromLocationId={fromLocation}
                toLocationId={toLocation}
                validTargetIds={(() => {
                  if (!fromLocation) return locations.map(l => l.id.toString())
                  const source = locations.find(l => l.id.toString() === fromLocation)
                  if (!source) return []

                  return locations.filter(target => {
                    if (target.id.toString() === fromLocation) return false

                    // Rule 1: Ward -> Same Hospital Ward OR Parent Hub
                    if (source.type === 'WARD') {
                      return (target.type === 'WARD' && target.parent_hub_id === source.parent_hub_id) ||
                        (target.id === source.parent_hub_id)
                    }
                    // Rule 2: Remote -> Other Remote OR Parent Hub
                    if (source.type === 'REMOTE') {
                      return target.type === 'REMOTE' || target.id === source.parent_hub_id
                    }
                    // Rule 3: Hub -> Children OR Other Hubs
                    if (source.type === 'HUB') {
                      return target.parent_hub_id === source.id || target.type === 'HUB'
                    }
                    return false
                  }).map(l => l.id.toString())
                })()}
              />

              {/* Hub-to-Hub Approval Notice */}
              {fromLocation && toLocation &&
                locations.find(l => l.id.toString() === fromLocation)?.type === 'HUB' &&
                locations.find(l => l.id.toString() === toLocation)?.type === 'HUB' && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 flex items-center gap-3 p-4 bg-amber-50 border-2 border-amber-200 rounded-xl"
                  >
                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-amber-900">Approval Required</p>
                      <p className="text-sm text-amber-700">
                        Hub-to-hub transfers require approval from a pharmacist at {locations.find(l => l.id.toString() === toLocation)?.name}
                      </p>
                    </div>
                  </motion.div>
                )}
            </div>

            {/* Form Controls and Stock Selection - 2 Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: Form Controls with Dropdowns */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-bold mb-4">Transfer Details</h3>

                <div className="space-y-4">
                  {/* From Location Dropdown */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      From Location
                    </label>
                    <div className="relative">
                      <select
                        value={fromLocation}
                        onChange={(e) => {
                          setFromLocation(e.target.value)
                          setToLocation('')
                          setSelectedItems([])
                        }}
                        className="w-full pl-4 pr-10 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl
                                   focus:outline-none focus:border-blue-500 focus:bg-white transition-all appearance-none
                                   font-medium"
                      >
                        <option value="">Select source location...</option>
                        {locations
                          .filter(loc => loc.type === 'HUB' || (user.location_id === loc.id))
                          .map(loc => {
                            const Icon = locationIcon[loc.type]
                            return (
                              <option key={loc.id} value={loc.id}>
                                {loc.type} - {loc.name}
                              </option>
                            )
                          })}
                      </select>
                      <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-gray-500">
                        <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                          <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" fillRule="evenodd"></path>
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* To Location Dropdown */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      To Location
                    </label>
                    <div className="relative">
                      <select
                        value={toLocation}
                        onChange={(e) => setToLocation(e.target.value)}
                        disabled={!fromLocation}
                        className="w-full pl-4 pr-10 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl
                                   focus:outline-none focus:border-maroon-500 focus:bg-white transition-all appearance-none
                                   disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                      >
                        <option value="">Select destination location...</option>
                        {fromLocation && locations
                          .filter(loc => {
                            const source = locations.find(l => l.id.toString() === fromLocation)
                            if (!source || loc.id.toString() === fromLocation) return false

                            // Apply transfer rules
                            if (source.type === 'WARD') {
                              return (loc.type === 'WARD' && loc.parent_hub_id === source.parent_hub_id) ||
                                (loc.id === source.parent_hub_id)
                            }
                            if (source.type === 'REMOTE') {
                              return loc.type === 'REMOTE' || loc.id === source.parent_hub_id
                            }
                            if (source.type === 'HUB') {
                              return loc.parent_hub_id === source.id || loc.type === 'HUB'
                            }
                            return false
                          })
                          .map(loc => (
                            <option key={loc.id} value={loc.id}>
                              {loc.type} - {loc.name}
                            </option>
                          ))}
                      </select>
                      <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-gray-500">
                        <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                          <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" fillRule="evenodd"></path>
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Selected Items Summary */}
                  {selectedItems.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="p-4 bg-blue-50 rounded-xl border-2 border-blue-200"
                    >
                      <p className="text-sm font-semibold text-blue-900 mb-1">
                        Items Selected
                      </p>
                      <p className="text-3xl font-bold text-blue-700">{selectedItems.length}</p>
                      <p className="text-sm text-blue-600 mt-1">
                        {selectedItems.length === 1 ? 'item' : 'items'} ready for transfer
                      </p>
                    </motion.div>
                  )}

                  {/* Create Transfer Button */}
                  <button
                    onClick={handleCreateTransfer}
                    disabled={!fromLocation || !toLocation || selectedItems.length === 0 || loading}
                    className="w-full py-4 bg-gradient-to-r from-maroon-600 to-maroon-800 text-white 
                             font-bold rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 
                             transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
                             flex items-center justify-center gap-2 text-lg"
                  >
                    {loading ? (
                      <>
                        <span className="spinner w-5 h-5" />
                        Creating Transfer...
                      </>
                    ) : (
                      <>
                        <TruckIcon className="w-6 h-6" />
                        Create Transfer
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Right: Stock Selection */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold">Available Stock</h3>

                  {/* Search */}
                  <div className="relative w-48">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg
                               focus:outline-none focus:border-maroon-500 focus:bg-white transition-all text-sm"
                    />
                  </div>
                </div>

                {fromLocation ? (
                  <div className="space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar">
                    {filteredStock.length === 0 ? (
                      <div className="text-center py-12 text-gray-400">
                        <Package className="w-12 h-12 mx-auto mb-4" />
                        <p>No available stock</p>
                      </div>
                    ) : (
                      <>
                        {filteredStock.map(item => (
                          <motion.div
                            key={item.id}
                            className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${selectedItems.includes(item.id)
                              ? 'border-maroon-500 bg-maroon-50'
                              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                              }`}
                            onClick={() => toggleItemSelection(item.id)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <p className="font-semibold text-sm">{item.drug_name}</p>
                                <div className="flex items-center gap-3 text-xs text-gray-600 mt-1">
                                  <span className="font-mono">{item.asset_id}</span>
                                  <span>Exp: {format(new Date(item.expiry_date), 'dd/MM/yy')}</span>
                                  <span className={`font-medium ${item.days_until_expiry > 90 ? 'text-emerald-600' :
                                    item.days_until_expiry > 30 ? 'text-amber-600' : 'text-red-600'
                                    }`}>
                                    {Math.floor(item.days_until_expiry)}d
                                  </span>
                                </div>
                              </div>

                              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${selectedItems.includes(item.id)
                                ? 'bg-maroon-600 border-maroon-600'
                                : 'border-gray-300'
                                }`}>
                                {selectedItems.includes(item.id) && (
                                  <CheckCircle className="w-3 h-3 text-white" />
                                )}
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-400">
                    <MapPin className="w-12 h-12 mx-auto mb-4" />
                    <p className="font-medium">Select a source location</p>
                    <p className="text-sm mt-1">Click on the map or use the dropdown above</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'pending' && (
          <motion.div
            key="pending"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            {transfers.filter(t => t.status === 'PENDING' || t.status === 'IN_TRANSIT').map(transfer => (
              <TransferCard key={transfer.id} transfer={transfer} onUpdate={fetchTransfers} />
            ))}

            {transfers.filter(t => t.status === 'PENDING' || t.status === 'IN_TRANSIT').length === 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
                <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No pending transfers</p>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'history' && (
          <motion.div
            key="history"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            {transfers.filter(t => t.status === 'COMPLETED' || t.status === 'CANCELLED').map(transfer => (
              <TransferCard key={transfer.id} transfer={transfer} readonly />
            ))}

            {transfers.filter(t => t.status === 'COMPLETED' || t.status === 'CANCELLED').length === 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
                <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No transfer history</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Transfer Card Component
function TransferCard({ transfer, onUpdate, readonly }) {
  const { user, canApproveTransfers } = useAuth()
  const { success, error: showError } = useNotification()
  const [loading, setLoading] = useState(false)

  const handleAction = async (action) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/transfer/${transfer.id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          version: transfer.version // Send current version
        })
      })

      const data = await response.json()

      if (response.ok) {
        success(
          action === 'approve' ? 'Transfer Approved' :
            action === 'complete' ? 'Transfer Completed' : 'Transfer Cancelled',
          `Transfer #${transfer.id} has been ${action}d`
        )
        onUpdate?.()
      } else if (response.status === 409) {
        showError('Update Conflict', 'Data has changed. Refreshing...')
        onUpdate?.() // Auto-refresh
      } else {
        showError(`Failed to ${action} transfer`, data.error)
      }
    } catch (err) {
      showError('Connection Error', `Failed to ${action} transfer`)
    } finally {
      setLoading(false)
    }
  }

  const statusConfig = {
    PENDING: { color: 'bg-amber-100 text-amber-800', icon: Clock },
    IN_TRANSIT: { color: 'bg-blue-100 text-blue-800', icon: TruckIcon },
    COMPLETED: { color: 'bg-emerald-100 text-emerald-800', icon: CheckCircle },
    CANCELLED: { color: 'bg-red-100 text-red-800', icon: XCircle }
  }

  const config = statusConfig[transfer.status]
  const StatusIcon = config.icon

  // Determine if user can approve THIS transfer
  // Must be a pharmacist AND from the destination hub (if it's a hub-to-hub transfer)
  // For now, we'll assume if it needs approval, it's a hub-to-hub transfer
  const canApproveThisTransfer = canApproveTransfers &&
    transfer.status === 'PENDING' &&
    user.location_id === transfer.to_location_id

  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2 ${config.color}`}>
            <StatusIcon className="w-4 h-4" />
            {transfer.status.replace('_', ' ')}
          </div>
          <span className="text-sm text-gray-500">
            Transfer #{transfer.id}
          </span>
        </div>

        <span className="text-sm text-gray-500">
          {format(new Date(transfer.created_at), 'dd MMM yyyy HH:mm')}
        </span>
      </div>

      <div className="flex items-center gap-4 mb-4">
        <div className="flex-1">
          <p className="text-sm text-gray-600 mb-1">From</p>
          <p className="font-semibold">{transfer.from_location}</p>
        </div>

        <ArrowRight className="w-5 h-5 text-gray-400" />

        <div className="flex-1">
          <p className="text-sm text-gray-600 mb-1">To</p>
          <p className="font-semibold">{transfer.to_location}</p>
        </div>
      </div>

      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
        <div className="text-sm text-gray-500">
          {transfer.item_count} items • Created by {transfer.created_by_name}
        </div>

        <div className="flex gap-2">
          {canApproveThisTransfer && (
            <button
              onClick={() => handleAction('approve')}
              disabled={loading}
              className="px-4 py-2 bg-maroon-600 text-white rounded-lg hover:bg-maroon-700 disabled:opacity-50"
            >
              Approve
            </button>
          )}

          {/* Only show Complete/Cancel if user has permission AND it's in the right state */}
          {/* Complete: Only if IN_TRANSIT (or PENDING if no approval needed) AND user is at destination */}
          {(transfer.status === 'IN_TRANSIT' || (transfer.status === 'PENDING' && !transfer.needs_approval)) &&
            user.location_id === transfer.to_location_id && (
              <button
                onClick={() => handleAction('complete')}
                disabled={loading}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
              >
                Receive
              </button>
            )}

          {/* Cancel: Only if PENDING and user created it OR is at source location */}
          {transfer.status === 'PENDING' && (user.id === transfer.created_by || user.location_id === transfer.from_location_id) && (
            <button
              onClick={() => handleAction('cancel')}
              disabled={loading}
              className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </motion.div>
  )
}

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  TruckIcon, MapPin, Package, ArrowRight, Clock,
  CheckCircle, XCircle, AlertTriangle, Search, Filter,
  Building2, Heart, Users, Thermometer
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

// Asset Tag Component - Represents a physical item
function AssetTag({ item }) {
  // Check for 2-8°C (Fridge) vs <25°C (Shelf)
  const isFridge = item.storage_temp && item.storage_temp.includes('2-8')
  const daysUntilExpiry = Math.floor(item.days_until_expiry)

  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 group hover:border-blue-300 transition-colors">
      <div className="flex items-center gap-3">
        {/* Storage Icon */}
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isFridge ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'
          }`}>
          {isFridge ? <Thermometer className="w-4 h-4" /> : <Package className="w-4 h-4" />}
        </div>

        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-gray-900 tracking-wider text-sm">
              {item.asset_id}
            </span>
            <span className="text-xs text-gray-500 font-medium px-1.5 py-0.5 bg-white rounded border border-gray-200">
              {item.batch_number}
            </span>
          </div>
          <p className="text-sm font-semibold text-gray-700">{item.drug_name}</p>
        </div>
      </div>

      {/* Expiry Badge */}
      <div className={`px-2 py-1 rounded text-xs font-bold flex flex-col items-end ${item.status_color === 'green' ? 'bg-emerald-100 text-emerald-700' :
        item.status_color === 'amber' ? 'bg-amber-100 text-amber-700' :
          'bg-red-100 text-red-700'
        }`}>
        <span>{format(new Date(item.expiry_date), 'dd MMM yy')}</span>
        <span className="text-[10px] opacity-80">{daysUntilExpiry} days</span>
      </div>
    </div>
  )
}

// Transfer Manifest Component (formerly TransferCard)
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
          version: transfer.version
        })
      })

      const data = await response.json()

      if (response.ok) {
        success(
          action === 'approve' ? 'Transfer Authorized' :
            action === 'complete' ? 'Shipment Received' : 'Transfer Cancelled',
          `Transfer #${transfer.id} has been processed`
        )
        onUpdate?.()
      } else if (response.status === 409) {
        showError('Update Conflict', 'Data has changed. Refreshing...')
        onUpdate?.()
      } else {
        showError(`Failed to ${action} transfer`, data.error)
      }
    } catch (err) {
      showError('Connection Error', `Failed to ${action} transfer`)
    } finally {
      setLoading(false)
    }
  }

  // Status Configuration
  const statusConfig = {
    PENDING: { label: 'DRAFT / PENDING', color: 'bg-amber-50 text-amber-700 border-amber-200', step: 1 },
    IN_TRANSIT: { label: 'IN TRANSIT', color: 'bg-blue-50 text-blue-700 border-blue-200', step: 2 },
    COMPLETED: { label: 'RECEIVED', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', step: 3 },
    CANCELLED: { label: 'VOID', color: 'bg-gray-100 text-gray-500 border-gray-200', step: 0 }
  }

  const config = statusConfig[transfer.status]

  // Permissions Logic
  const isHubToHub = transfer.from_location_type === 'HUB' && transfer.to_location_type === 'HUB'
  const needsApproval = isHubToHub

  const canApproveThisTransfer = canApproveTransfers &&
    transfer.status === 'PENDING' &&
    needsApproval &&
    user.location_id === transfer.to_location_id

  const canReceiveThisTransfer = transfer.status === 'IN_TRANSIT' &&
    user.location_id === transfer.to_location_id

  const canCancelThisTransfer = transfer.status === 'PENDING' &&
    (user.id === transfer.created_by || user.location_id === transfer.from_location_id)

  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden group"
    >
      {/* Manifest Header - "Ticket" Style */}
      <div className="bg-gray-50 border-b border-gray-200 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-lg border border-gray-200 flex items-center justify-center shadow-sm">
            <TruckIcon className="w-5 h-5 text-gray-600" />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Transfer ID</p>
            <p className="text-lg font-mono font-bold text-gray-900">#{transfer.id.toString().padStart(5, '0')}</p>
          </div>
        </div>

        <div className={`px-4 py-1.5 rounded-full border text-xs font-bold tracking-wide ${config.color}`}>
          {config.label}
        </div>
      </div>

      <div className="p-6">
        {/* Route Visualization */}
        <div className="flex items-center justify-between mb-8 relative">
          {/* Connecting Line */}
          <div className="absolute top-1/2 left-10 right-10 h-0.5 bg-gray-100 -z-10" />

          {/* Source */}
          <div className="flex flex-col items-start relative bg-white pr-4">
            <p className="text-xs font-bold text-gray-400 uppercase mb-1">Origin</p>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <p className="font-bold text-gray-900">{transfer.from_location}</p>
            </div>
            <p className="text-xs text-gray-500 mt-1 pl-4">
              {format(new Date(transfer.created_at), 'dd MMM HH:mm')} • {transfer.created_by_name}
            </p>
          </div>

          {/* Arrow */}
          <div className="bg-white px-2 text-gray-300">
            <ArrowRight className="w-5 h-5" />
          </div>

          {/* Destination */}
          <div className="flex flex-col items-end relative bg-white pl-4">
            <p className="text-xs font-bold text-gray-400 uppercase mb-1">Destination</p>
            <div className="flex items-center gap-2">
              <p className="font-bold text-gray-900 text-right">{transfer.to_location}</p>
              <div className="w-2 h-2 rounded-full bg-maroon-600" />
            </div>
            {transfer.status === 'COMPLETED' && (
              <p className="text-xs text-emerald-600 mt-1 pr-4 font-medium">
                Received {transfer.completed_at ? format(new Date(transfer.completed_at), 'dd MMM HH:mm') : ''}
              </p>
            )}
          </div>
        </div>

        {/* Items List - "Asset Tags" */}
        <div className="mb-6">
          <p className="text-xs font-bold text-gray-400 uppercase mb-3">Shipment Contents ({transfer.item_count})</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {transfer.items && transfer.items.map(item => (
              <AssetTag key={item.id} item={item} />
            ))}
          </div>
        </div>

        {/* Action Footer - "Signature" Area */}
        {(canApproveThisTransfer || canReceiveThisTransfer || canCancelThisTransfer) && (
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 bg-gray-50/50 -mx-6 -mb-6 p-4">
            {canCancelThisTransfer && (
              <button
                onClick={() => handleAction('cancel')}
                disabled={loading}
                className="px-4 py-2 text-gray-600 font-medium hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm"
              >
                Void Transfer
              </button>
            )}

            {canApproveThisTransfer && (
              <button
                onClick={() => handleAction('approve')}
                disabled={loading}
                className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg shadow-sm 
                         hover:bg-indigo-700 hover:shadow-md transition-all flex items-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                Authorize Shipment
              </button>
            )}

            {canReceiveThisTransfer && (
              <button
                onClick={() => handleAction('complete')}
                disabled={loading}
                className="px-6 py-2 bg-emerald-600 text-white font-bold rounded-lg shadow-sm 
                         hover:bg-emerald-700 hover:shadow-md transition-all flex items-center gap-2"
              >
                <Package className="w-4 h-4" />
                Confirm Receipt
              </button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
}

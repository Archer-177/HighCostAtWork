import { useState, useEffect } from 'react'
import {
  ArrowRight,
  Package,
  CheckCircle,
  XCircle,
  Clock,
  Truck,
  Search,
  AlertCircle,
  MapPin,
  Filter
} from 'lucide-react'
import { stockAPI } from '../api/stock'
import { transfersAPI } from '../api/transfers'
import { adminAPI } from '../api/admin'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'

export default function StockTransfer() {
  const user = useAuthStore((state) => state.user)
  const [activeTab, setActiveTab] = useState('create') // 'create', 'view', or 'map'

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-4xl font-display font-bold gradient-text mb-2">
          Stock Transfers
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Transfer stock between locations in the network
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('create')}
          className={`px-6 py-3 font-semibold transition-colors relative ${
            activeTab === 'create'
              ? 'text-maroon dark:text-ochre'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
        >
          Create Transfer
          {activeTab === 'create' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-maroon dark:bg-ochre" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('view')}
          className={`px-6 py-3 font-semibold transition-colors relative ${
            activeTab === 'view'
              ? 'text-maroon dark:text-ochre'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
        >
          View Transfers
          {activeTab === 'view' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-maroon dark:bg-ochre" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('map')}
          className={`px-6 py-3 font-semibold transition-colors relative ${
            activeTab === 'map'
              ? 'text-maroon dark:text-ochre'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
        >
          Network Map
          {activeTab === 'map' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-maroon dark:bg-ochre" />
          )}
        </button>
      </div>

      {/* Content */}
      {activeTab === 'create' && <CreateTransfer />}
      {activeTab === 'view' && <ViewTransfers />}
      {activeTab === 'map' && <NetworkMap setActiveTab={setActiveTab} />}
    </div>
  )
}

// ============================================================================
// CREATE TRANSFER COMPONENT
// ============================================================================
function CreateTransfer() {
  const user = useAuthStore((state) => state.user)
  const [stock, setStock] = useState([])
  const [locations, setLocations] = useState([])
  const [selectedVials, setSelectedVials] = useState([])
  const [destinationId, setDestinationId] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all') // all, healthy, warning, critical

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [stockData, locationsData] = await Promise.all([
        stockAPI.searchStock({
          location_id: user.location_id,
          status: 'AVAILABLE'
        }),
        adminAPI.getLocations()
      ])
      setStock(stockData || [])
      setLocations(getValidDestinations(locationsData || []))
    } catch (error) {
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const getValidDestinations = (allLocations) => {
    // Filter locations based on business rules
    const currentLocation = allLocations.find((loc) => loc.id === user.location_id)
    if (!currentLocation) return []

    const validDestinations = []

    allLocations.forEach((loc) => {
      if (loc.id === user.location_id) return // Can't transfer to self

      // WARD can transfer to:
      if (currentLocation.type === 'WARD') {
        // Same parent hub wards
        if (
          loc.type === 'WARD' &&
          loc.parent_hub_id === currentLocation.parent_hub_id
        ) {
          validDestinations.push(loc)
        }
        // Own parent hub
        if (loc.type === 'HUB' && loc.id === currentLocation.parent_hub_id) {
          validDestinations.push(loc)
        }
      }

      // REMOTE can transfer to:
      if (currentLocation.type === 'REMOTE') {
        // Other remote sites
        if (loc.type === 'REMOTE') {
          validDestinations.push(loc)
        }
        // Parent hub (not Whyalla)
        if (
          loc.type === 'HUB' &&
          loc.id === currentLocation.parent_hub_id &&
          loc.id !== 2 // Whyalla Hub ID
        ) {
          validDestinations.push(loc)
        }
      }

      // HUB can transfer to:
      if (currentLocation.type === 'HUB') {
        // Own child wards
        if (loc.type === 'WARD' && loc.parent_hub_id === currentLocation.id) {
          validDestinations.push(loc)
        }
        // Other hubs
        if (loc.type === 'HUB') {
          validDestinations.push(loc)
        }
        // Remote sites (not if Whyalla Hub)
        if (
          loc.type === 'REMOTE' &&
          user.location_id !== 2 && // Not Whyalla Hub
          loc.parent_hub_id === currentLocation.id
        ) {
          validDestinations.push(loc)
        }
      }
    })

    return validDestinations
  }

  const filteredStock = stock.filter((vial) => {
    // Search filter
    const matchesSearch =
      searchTerm === '' ||
      vial.drug_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vial.asset_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vial.batch_number.toLowerCase().includes(searchTerm.toLowerCase())

    // Status filter
    const matchesStatus =
      filterStatus === 'all' ||
      (filterStatus === 'healthy' && vial.status_color === 'green') ||
      (filterStatus === 'warning' && vial.status_color === 'amber') ||
      (filterStatus === 'critical' && vial.status_color === 'red')

    return matchesSearch && matchesStatus
  })

  const toggleVialSelection = (vialId) => {
    if (selectedVials.includes(vialId)) {
      setSelectedVials(selectedVials.filter((id) => id !== vialId))
    } else {
      setSelectedVials([...selectedVials, vialId])
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (selectedVials.length === 0) {
      toast.error('Please select at least one vial to transfer')
      return
    }

    if (!destinationId) {
      toast.error('Please select a destination location')
      return
    }

    setSubmitting(true)

    try {
      const response = await transfersAPI.createTransfer({
        from_location_id: user.location_id,
        to_location_id: parseInt(destinationId),
        vial_ids: selectedVials,
        created_by: user.id
      })

      if (response.success) {
        toast.success(
          `Transfer created successfully! Status: ${response.status}`,
          { duration: 5000 }
        )
        // Reset form
        setSelectedVials([])
        setDestinationId('')
        // Reload stock
        loadData()
      } else {
        toast.error(response.error || 'Failed to create transfer')
      }
    } catch (error) {
      console.error('Transfer creation error:', error)
      toast.error(error.response?.data?.error || 'Failed to create transfer')
    } finally {
      setSubmitting(false)
    }
  }

  const getDestinationName = () => {
    const dest = locations.find((loc) => loc.id === parseInt(destinationId))
    return dest ? dest.name : ''
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-maroon"></div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main Panel - Stock Selection */}
      <div className="lg:col-span-2">
        <div className="card">
          <div className="mb-4">
            <h2 className="text-xl font-semibold mb-4">
              Available Stock at {user.location_name}
            </h2>

            {/* Filters */}
            <div className="flex gap-4 mb-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by drug, asset ID, or batch..."
                  className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-maroon focus:border-transparent"
                />
              </div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-maroon focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="healthy">Healthy (90+ days)</option>
                <option value="warning">Warning (30-90 days)</option>
                <option value="critical">Critical (&lt;30 days)</option>
              </select>
            </div>
          </div>

          {/* Stock List */}
          {filteredStock.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No available stock found</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {filteredStock.map((vial) => (
                <div
                  key={vial.id}
                  onClick={() => toggleVialSelection(vial.id)}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    selectedVials.includes(vial.id)
                      ? 'border-maroon bg-maroon/5 dark:border-ochre dark:bg-ochre/5'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-mono text-sm font-bold text-maroon dark:text-ochre">
                          {vial.asset_id}
                        </span>
                        <span
                          className={`badge ${
                            vial.status_color === 'green'
                              ? 'badge-green'
                              : vial.status_color === 'amber'
                              ? 'badge-amber'
                              : 'badge-red'
                          }`}
                        >
                          {vial.days_until_expiry} days
                        </span>
                      </div>
                      <div className="font-medium text-gray-900 dark:text-gray-100 mb-1">
                        {vial.drug_name}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Batch: {vial.batch_number} • Expires:{' '}
                        {new Date(vial.expiry_date).toLocaleDateString()}
                      </div>
                    </div>
                    <div
                      className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
                        selectedVials.includes(vial.id)
                          ? 'bg-maroon border-maroon dark:bg-ochre dark:border-ochre'
                          : 'border-gray-300 dark:border-gray-600'
                      }`}
                    >
                      {selectedVials.includes(vial.id) && (
                        <CheckCircle className="w-4 h-4 text-white" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Side Panel - Transfer Details */}
      <div className="lg:col-span-1">
        <form onSubmit={handleSubmit}>
          <div className="card sticky top-6">
            <h3 className="text-lg font-semibold mb-4">Transfer Details</h3>

            {/* Selected Count */}
            <div className="mb-4 p-4 bg-gradient-to-br from-maroon/10 to-ochre/10 dark:from-maroon/20 dark:to-ochre/20 rounded-lg">
              <div className="text-center">
                <div className="text-4xl font-bold text-maroon dark:text-ochre mb-1">
                  {selectedVials.length}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Vials Selected
                </div>
              </div>
            </div>

            {/* From Location */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">From</label>
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg flex items-center gap-2">
                <MapPin className="w-4 h-4 text-gray-400" />
                <span className="text-sm">{user.location_name}</span>
              </div>
            </div>

            {/* Arrow */}
            <div className="flex justify-center mb-4">
              <ArrowRight className="w-6 h-6 text-gray-400" />
            </div>

            {/* To Location */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">
                To <span className="text-red-500">*</span>
              </label>
              <select
                value={destinationId}
                onChange={(e) => setDestinationId(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-maroon focus:border-transparent"
                required
                disabled={locations.length === 0}
              >
                <option value="">Select destination...</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} ({loc.type})
                  </option>
                ))}
              </select>
              {locations.length === 0 && (
                <p className="text-sm text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  No valid destinations available
                </p>
              )}
            </div>

            {/* Info Box */}
            {selectedVials.length > 0 && destinationId && (
              <div className="mb-6 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="text-sm text-blue-800 dark:text-blue-200">
                  <p className="font-medium mb-1">Transfer Summary</p>
                  <p>
                    {selectedVials.length} vial(s) from {user.location_name} to{' '}
                    {getDestinationName()}
                  </p>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={
                submitting ||
                selectedVials.length === 0 ||
                !destinationId ||
                locations.length === 0
              }
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Creating...
                </>
              ) : (
                <>
                  <Truck className="w-5 h-5" />
                  Create Transfer
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ============================================================================
// VIEW TRANSFERS COMPONENT
// ============================================================================
function ViewTransfers() {
  const user = useAuthStore((state) => state.user)
  const canApprove = useAuthStore((state) => state.canApproveTransfers)
  const [transfers, setTransfers] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all') // all, incoming, outgoing, pending

  useEffect(() => {
    loadTransfers()
  }, [])

  const loadTransfers = async () => {
    try {
      const data = await transfersAPI.getTransfers(user.location_id)
      setTransfers(data || [])
    } catch (error) {
      toast.error('Failed to load transfers')
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (transferId, version) => {
    try {
      const response = await transfersAPI.approveTransfer(transferId, {
        user_id: user.id,
        version
      })

      if (response.success) {
        toast.success('Transfer approved successfully')
        loadTransfers()
      } else {
        toast.error(response.error || 'Failed to approve transfer')
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to approve transfer')
    }
  }

  const handleComplete = async (transferId, version) => {
    try {
      const response = await transfersAPI.completeTransfer(transferId, {
        user_id: user.id,
        version
      })

      if (response.success) {
        toast.success('Transfer completed successfully')
        loadTransfers()
      } else {
        toast.error(response.error || 'Failed to complete transfer')
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to complete transfer')
    }
  }

  const handleCancel = async (transferId, version) => {
    if (!confirm('Are you sure you want to cancel this transfer?')) return

    try {
      const response = await transfersAPI.cancelTransfer(transferId, {
        user_id: user.id,
        version
      })

      if (response.success) {
        toast.success('Transfer cancelled')
        loadTransfers()
      } else {
        toast.error(response.error || 'Failed to cancel transfer')
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to cancel transfer')
    }
  }

  const filteredTransfers = transfers.filter((transfer) => {
    if (filter === 'all') return true
    if (filter === 'incoming') return transfer.to_location_id === user.location_id
    if (filter === 'outgoing') return transfer.from_location_id === user.location_id
    if (filter === 'pending')
      return transfer.status === 'PENDING_APPROVAL' || transfer.status === 'IN_TRANSIT'
    return true
  })

  const getStatusBadge = (status) => {
    const badges = {
      PENDING_APPROVAL: (
        <span className="badge badge-amber flex items-center gap-1">
          <Clock className="w-3 h-3" />
          Pending Approval
        </span>
      ),
      IN_TRANSIT: (
        <span className="badge badge-blue flex items-center gap-1">
          <Truck className="w-3 h-3" />
          In Transit
        </span>
      ),
      COMPLETED: (
        <span className="badge badge-green flex items-center gap-1">
          <CheckCircle className="w-3 h-3" />
          Completed
        </span>
      ),
      CANCELLED: (
        <span className="badge badge-red flex items-center gap-1">
          <XCircle className="w-3 h-3" />
          Cancelled
        </span>
      )
    }
    return badges[status] || <span className="badge">{status}</span>
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-maroon"></div>
      </div>
    )
  }

  return (
    <div>
      {/* Filters */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'all'
              ? 'bg-maroon text-white dark:bg-ochre'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setFilter('incoming')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'incoming'
              ? 'bg-maroon text-white dark:bg-ochre'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
          }`}
        >
          Incoming
        </button>
        <button
          onClick={() => setFilter('outgoing')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'outgoing'
              ? 'bg-maroon text-white dark:bg-ochre'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
          }`}
        >
          Outgoing
        </button>
        <button
          onClick={() => setFilter('pending')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'pending'
              ? 'bg-maroon text-white dark:bg-ochre'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
          }`}
        >
          Pending
        </button>
      </div>

      {/* Transfers List */}
      {filteredTransfers.length === 0 ? (
        <div className="card text-center py-12 text-gray-500 dark:text-gray-400">
          <Truck className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No transfers found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTransfers.map((transfer) => (
            <div key={transfer.id} className="card hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    {getStatusBadge(transfer.status)}
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      #{transfer.id}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-900 dark:text-gray-100 mb-1">
                    <span className="font-medium">{transfer.from_location_name}</span>
                    <ArrowRight className="w-4 h-4 text-gray-400" />
                    <span className="font-medium">{transfer.to_location_name}</span>
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Created by {transfer.creator_username} on{' '}
                    {new Date(transfer.created_at).toLocaleString()}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-maroon dark:text-ochre">
                    {transfer.item_count}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    vial{transfer.item_count !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                {transfer.status === 'PENDING_APPROVAL' && canApprove() && (
                  <button
                    onClick={() => handleApprove(transfer.id, transfer.version)}
                    className="btn-primary text-sm flex items-center gap-1"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Approve
                  </button>
                )}
                {transfer.status === 'IN_TRANSIT' &&
                  transfer.to_location_id === user.location_id && (
                    <button
                      onClick={() => handleComplete(transfer.id, transfer.version)}
                      className="btn-primary text-sm flex items-center gap-1"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Complete
                    </button>
                  )}
                {(transfer.status === 'PENDING_APPROVAL' ||
                  transfer.status === 'IN_TRANSIT') &&
                  transfer.created_by === user.id && (
                    <button
                      onClick={() => handleCancel(transfer.id, transfer.version)}
                      className="btn-danger text-sm flex items-center gap-1"
                    >
                      <XCircle className="w-4 h-4" />
                      Cancel
                    </button>
                  )}
              </div>

              {/* Transfer Items Preview */}
              {transfer.items && transfer.items.length > 0 && (
                <details className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-maroon dark:hover:text-ochre">
                    View Items ({transfer.items.length})
                  </summary>
                  <div className="mt-3 space-y-2">
                    {transfer.items.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-mono text-xs font-bold text-maroon dark:text-ochre">
                            {item.asset_id}
                          </span>
                          <span
                            className={`badge text-xs ${
                              item.status_color === 'green'
                                ? 'badge-green'
                                : item.status_color === 'amber'
                                ? 'badge-amber'
                                : 'badge-red'
                            }`}
                          >
                            {item.days_until_expiry}d
                          </span>
                        </div>
                        <div className="font-medium">{item.drug_name}</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">
                          Batch: {item.batch_number} • Expires:{' '}
                          {new Date(item.expiry_date).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// NETWORK MAP COMPONENT
// ============================================================================
function NetworkMap({ setActiveTab }) {
  const user = useAuthStore((state) => state.user)
  const [locations, setLocations] = useState([])
  const [stockLevels, setStockLevels] = useState({})
  const [loading, setLoading] = useState(true)
  const [selectedLocation, setSelectedLocation] = useState(null)
  const [hoveredLocation, setHoveredLocation] = useState(null)

  useEffect(() => {
    loadMapData()
  }, [])

  const loadMapData = async () => {
    try {
      const locationsData = await adminAPI.getLocations()
      setLocations(locationsData || [])

      // Load stock data for each location
      const stockPromises = (locationsData || []).map(async (loc) => {
        try {
          const stock = await stockAPI.searchStock({
            location_id: loc.id,
            status: 'AVAILABLE'
          })
          return { locationId: loc.id, stock: stock || [] }
        } catch {
          return { locationId: loc.id, stock: [] }
        }
      })

      const stockResults = await Promise.all(stockPromises)
      const stockMap = {}
      stockResults.forEach(({ locationId, stock }) => {
        // Calculate health based on expiry
        const healthy = stock.filter((v) => v.status_color === 'green').length
        const warning = stock.filter((v) => v.status_color === 'amber').length
        const critical = stock.filter((v) => v.status_color === 'red').length
        const total = stock.length

        stockMap[locationId] = {
          total,
          healthy,
          warning,
          critical,
          healthScore:
            total === 0 ? 0 : ((healthy + warning * 0.5) / total) * 100
        }
      })
      setStockLevels(stockMap)
    } catch (error) {
      toast.error('Failed to load network map data')
    } finally {
      setLoading(false)
    }
  }

  // Separate locations by hub
  const portAugustaHub = locations.find((loc) => loc.id === 1)
  const whyallaHub = locations.find((loc) => loc.id === 2)
  const portAugustaChildren = locations.filter(
    (loc) => loc.parent_hub_id === 1 && loc.id !== 1
  )
  const whyallaChildren = locations.filter(
    (loc) => loc.parent_hub_id === 2 && loc.id !== 2
  )

  // Check if transfer is valid between two locations
  const canTransferBetween = (fromId, toId) => {
    if (fromId === toId) return false

    const from = locations.find((l) => l.id === fromId)
    const to = locations.find((l) => l.id === toId)
    if (!from || !to) return false

    // WARD transfers
    if (from.type === 'WARD') {
      if (to.type === 'WARD' && to.parent_hub_id === from.parent_hub_id)
        return true
      if (to.type === 'HUB' && to.id === from.parent_hub_id) return true
      return false
    }

    // REMOTE transfers
    if (from.type === 'REMOTE') {
      if (to.type === 'REMOTE') return true
      if (to.type === 'HUB' && to.id === from.parent_hub_id && to.id !== 2)
        return true
      return false
    }

    // HUB transfers
    if (from.type === 'HUB') {
      if (to.type === 'WARD' && to.parent_hub_id === from.id) return true
      if (to.type === 'HUB') return true
      if (to.type === 'REMOTE' && from.id !== 2 && to.parent_hub_id === from.id)
        return true
      return false
    }

    return false
  }

  // Get node color based on stock health
  const getNodeColor = (locationId) => {
    const stock = stockLevels[locationId]
    if (!stock || stock.total === 0) return 'bg-gray-300 dark:bg-gray-600'
    if (stock.critical > 0) return 'bg-red-500'
    if (stock.warning > 0) return 'bg-amber-500'
    return 'bg-green-500'
  }

  // Get node border for current user location
  const getNodeBorder = (locationId) => {
    if (locationId === user.location_id) return 'ring-4 ring-maroon dark:ring-ochre'
    if (hoveredLocation === locationId) return 'ring-2 ring-gray-400'
    return ''
  }

  const LocationNode = ({ location, x, y, isHub = false }) => {
    const stock = stockLevels[location.id] || { total: 0 }
    const isSelected = selectedLocation?.id === location.id
    const isHovered = hoveredLocation === location.id
    const isCurrent = location.id === user.location_id

    return (
      <g
        className="cursor-pointer transition-all"
        onClick={() => setSelectedLocation(location)}
        onMouseEnter={() => setHoveredLocation(location.id)}
        onMouseLeave={() => setHoveredLocation(null)}
      >
        {/* Connection lines (drawn before node for z-index) */}
        {isHovered &&
          locations.map((otherLoc) => {
            if (canTransferBetween(location.id, otherLoc.id)) {
              const otherNode = getLocationPosition(otherLoc.id)
              if (otherNode) {
                return (
                  <line
                    key={`line-${location.id}-${otherLoc.id}`}
                    x1={x}
                    y1={y}
                    x2={otherNode.x}
                    y2={otherNode.y}
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeDasharray="5,5"
                    className="text-maroon dark:text-ochre opacity-50"
                  />
                )
              }
            }
            return null
          })}

        {/* Node circle */}
        <circle
          cx={x}
          cy={y}
          r={isHub ? 40 : 30}
          className={`${getNodeColor(location.id)} ${getNodeBorder(
            location.id
          )} transition-all ${isHovered ? 'scale-110' : ''}`}
          style={{
            filter: isSelected
              ? 'drop-shadow(0 10px 20px rgba(138, 42, 43, 0.5))'
              : isHovered
              ? 'drop-shadow(0 5px 10px rgba(0, 0, 0, 0.3))'
              : 'none',
            transform: isHovered ? 'scale(1.1)' : 'scale(1)',
            transformOrigin: `${x}px ${y}px`
          }}
        />

        {/* Hub icon (if hub) */}
        {isHub && (
          <text
            x={x}
            y={y - 5}
            textAnchor="middle"
            className="fill-white text-xl font-bold pointer-events-none"
          >
            ⚕
          </text>
        )}

        {/* Stock count */}
        <text
          x={x}
          y={isHub ? y + 10 : y + 5}
          textAnchor="middle"
          className="fill-white text-xs font-bold pointer-events-none"
        >
          {stock.total}
        </text>

        {/* Location name */}
        <text
          x={x}
          y={y + (isHub ? 60 : 50)}
          textAnchor="middle"
          className="fill-gray-900 dark:fill-gray-100 text-sm font-medium pointer-events-none"
        >
          {location.name.length > 20
            ? location.name.substring(0, 17) + '...'
            : location.name}
        </text>

        {/* Current location indicator */}
        {isCurrent && (
          <text
            x={x}
            y={y - (isHub ? 50 : 40)}
            textAnchor="middle"
            className="fill-maroon dark:fill-ochre text-xs font-bold pointer-events-none"
          >
            ● YOU
          </text>
        )}

        {/* Type badge */}
        <text
          x={x}
          y={y + (isHub ? 75 : 65)}
          textAnchor="middle"
          className="fill-gray-500 dark:fill-gray-400 text-xs pointer-events-none"
        >
          {location.type}
        </text>
      </g>
    )
  }

  const getLocationPosition = (locationId) => {
    const positions = calculatePositions()
    return positions[locationId]
  }

  const calculatePositions = () => {
    const positions = {}
    const svgWidth = 1200
    const svgHeight = 800

    // Port Augusta Hub (left side)
    if (portAugustaHub) {
      positions[portAugustaHub.id] = { x: 250, y: svgHeight / 2 }

      // Arrange children in a circle around hub
      portAugustaChildren.forEach((child, idx) => {
        const angle =
          (idx / portAugustaChildren.length) * 2 * Math.PI - Math.PI / 2
        const radius = 200
        positions[child.id] = {
          x: 250 + Math.cos(angle) * radius,
          y: svgHeight / 2 + Math.sin(angle) * radius
        }
      })
    }

    // Whyalla Hub (right side)
    if (whyallaHub) {
      positions[whyallaHub.id] = { x: 950, y: svgHeight / 2 }

      // Arrange children in a circle around hub
      whyallaChildren.forEach((child, idx) => {
        const angle =
          (idx / whyallaChildren.length) * 2 * Math.PI - Math.PI / 2
        const radius = 200
        positions[child.id] = {
          x: 950 + Math.cos(angle) * radius,
          y: svgHeight / 2 + Math.sin(angle) * radius
        }
      })
    }

    return positions
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-maroon"></div>
      </div>
    )
  }

  const positions = calculatePositions()

  return (
    <div className="space-y-6">
      {/* Legend */}
      <div className="card">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-green-500"></div>
              <span className="text-sm">Healthy Stock</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-amber-500"></div>
              <span className="text-sm">Warning (30-90 days)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-red-500"></div>
              <span className="text-sm">Critical (&lt;30 days)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-gray-300 dark:bg-gray-600"></div>
              <span className="text-sm">No Stock</span>
            </div>
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Hover over a location to see valid transfer routes • Click for details
          </div>
        </div>
      </div>

      {/* Network Map */}
      <div className="card overflow-x-auto">
        <svg
          viewBox="0 0 1200 800"
          className="w-full"
          style={{ minHeight: '600px' }}
        >
          {/* Hub connection line */}
          {portAugustaHub && whyallaHub && (
            <line
              x1={positions[portAugustaHub.id]?.x}
              y1={positions[portAugustaHub.id]?.y}
              x2={positions[whyallaHub.id]?.x}
              y2={positions[whyallaHub.id]?.y}
              stroke="currentColor"
              strokeWidth="3"
              className="text-gray-300 dark:text-gray-600"
            />
          )}

          {/* Hub to children connection lines */}
          {portAugustaHub &&
            portAugustaChildren.map((child) => (
              <line
                key={`pa-line-${child.id}`}
                x1={positions[portAugustaHub.id]?.x}
                y1={positions[portAugustaHub.id]?.y}
                x2={positions[child.id]?.x}
                y2={positions[child.id]?.y}
                stroke="currentColor"
                strokeWidth="2"
                className="text-gray-200 dark:text-gray-700"
              />
            ))}

          {whyallaHub &&
            whyallaChildren.map((child) => (
              <line
                key={`wh-line-${child.id}`}
                x1={positions[whyallaHub.id]?.x}
                y1={positions[whyallaHub.id]?.y}
                x2={positions[child.id]?.x}
                y2={positions[child.id]?.y}
                stroke="currentColor"
                strokeWidth="2"
                className="text-gray-200 dark:text-gray-700"
              />
            ))}

          {/* Location nodes */}
          {portAugustaHub && (
            <LocationNode
              location={portAugustaHub}
              x={positions[portAugustaHub.id]?.x}
              y={positions[portAugustaHub.id]?.y}
              isHub={true}
            />
          )}

          {whyallaHub && (
            <LocationNode
              location={whyallaHub}
              x={positions[whyallaHub.id]?.x}
              y={positions[whyallaHub.id]?.y}
              isHub={true}
            />
          )}

          {portAugustaChildren.map(
            (child) =>
              positions[child.id] && (
                <LocationNode
                  key={child.id}
                  location={child}
                  x={positions[child.id].x}
                  y={positions[child.id].y}
                />
              )
          )}

          {whyallaChildren.map(
            (child) =>
              positions[child.id] && (
                <LocationNode
                  key={child.id}
                  location={child}
                  x={positions[child.id].x}
                  y={positions[child.id].y}
                />
              )
          )}
        </svg>
      </div>

      {/* Location Details Panel */}
      {selectedLocation && (
        <div className="card">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-xl font-semibold mb-1">
                {selectedLocation.name}
              </h3>
              <div className="flex items-center gap-2">
                <span className="badge">{selectedLocation.type}</span>
                {selectedLocation.id === user.location_id && (
                  <span className="badge badge-maroon">Your Location</span>
                )}
              </div>
            </div>
            <button
              onClick={() => setSelectedLocation(null)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <XCircle className="w-6 h-6" />
            </button>
          </div>

          {/* Stock Summary */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {stockLevels[selectedLocation.id]?.total || 0}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                Total Vials
              </div>
            </div>
            <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div className="text-2xl font-bold text-green-700 dark:text-green-400">
                {stockLevels[selectedLocation.id]?.healthy || 0}
              </div>
              <div className="text-xs text-green-600 dark:text-green-400">
                Healthy
              </div>
            </div>
            <div className="text-center p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
              <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">
                {stockLevels[selectedLocation.id]?.warning || 0}
              </div>
              <div className="text-xs text-amber-600 dark:text-amber-400">
                Warning
              </div>
            </div>
            <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <div className="text-2xl font-bold text-red-700 dark:text-red-400">
                {stockLevels[selectedLocation.id]?.critical || 0}
              </div>
              <div className="text-xs text-red-600 dark:text-red-400">
                Critical
              </div>
            </div>
          </div>

          {/* Transfer Options */}
          <div>
            <h4 className="font-semibold mb-3">Valid Transfer Destinations</h4>
            <div className="grid grid-cols-2 gap-2">
              {locations
                .filter((loc) =>
                  canTransferBetween(selectedLocation.id, loc.id)
                )
                .map((loc) => (
                  <div
                    key={loc.id}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      <span className="text-sm">{loc.name}</span>
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {loc.type}
                    </span>
                  </div>
                ))}
            </div>
            {locations.filter((loc) =>
              canTransferBetween(selectedLocation.id, loc.id)
            ).length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                No valid transfer destinations from this location
              </p>
            )}
          </div>

          {/* Create Transfer Button */}
          {selectedLocation.id === user.location_id && (
            <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setActiveTab('create')}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                <Truck className="w-5 h-5" />
                Create Transfer from This Location
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  Package,
  ArrowRight,
  CheckCircle,
  Trash2,
  MapPin,
  User,
  Calendar,
  FileText,
  Sparkles
} from 'lucide-react'
import { stockAPI } from '../api/stock'
import toast from 'react-hot-toast'

export default function AssetTimeline() {
  const [assetId, setAssetId] = useState('')
  const [searching, setSearching] = useState(false)
  const [journeyData, setJourneyData] = useState(null)

  const handleSearch = async (e) => {
    e.preventDefault()

    if (!assetId.trim()) {
      toast.error('Please enter an Asset ID')
      return
    }

    setSearching(true)

    try {
      const data = await stockAPI.getStockJourney(assetId.trim())
      if (data) {
        setJourneyData(data)
      } else {
        toast.error('Asset not found')
        setJourneyData(null)
      }
    } catch (error) {
      console.error('Journey fetch error:', error)
      toast.error('Failed to load asset journey')
      setJourneyData(null)
    } finally {
      setSearching(false)
    }
  }

  const handleClear = () => {
    setAssetId('')
    setJourneyData(null)
  }

  const getEventIcon = (type) => {
    switch (type) {
      case 'CREATED':
        return <Package className="w-5 h-5" />
      case 'TRANSFER':
        return <ArrowRight className="w-5 h-5" />
      case 'USED':
        return <CheckCircle className="w-5 h-5" />
      case 'DISCARDED':
        return <Trash2 className="w-5 h-5" />
      default:
        return <Sparkles className="w-5 h-5" />
    }
  }

  const getEventColor = (type) => {
    switch (type) {
      case 'CREATED':
        return 'bg-green-500'
      case 'TRANSFER':
        return 'bg-blue-500'
      case 'USED':
        return 'bg-maroon'
      case 'DISCARDED':
        return 'bg-red-500'
      default:
        return 'bg-gray-500'
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'AVAILABLE':
        return 'badge-green'
      case 'USED_CLINICAL':
        return 'badge-blue'
      case 'DISCARDED':
        return 'badge-red'
      case 'IN_TRANSIT':
        return 'badge-amber'
      default:
        return 'badge'
    }
  }

  return (
    <div className="space-y-6">
      {/* Search Section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="card"
      >
        <h2 className="text-2xl font-bold mb-4 gradient-text">Asset Journey Tracker</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Track the complete journey of any medication vial from receipt to final use or disposal
        </p>

        <form onSubmit={handleSearch} className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={assetId}
              onChange={(e) => setAssetId(e.target.value)}
              placeholder="Enter Asset ID (e.g., TNK-PAH-1702345-abc123)"
              className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-maroon focus:border-transparent"
            />
          </div>
          <button
            type="submit"
            disabled={searching}
            className="btn-primary px-8"
          >
            {searching ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Searching...
              </div>
            ) : (
              'Search'
            )}
          </button>
          {journeyData && (
            <button
              type="button"
              onClick={handleClear}
              className="btn-secondary px-6"
            >
              Clear
            </button>
          )}
        </form>
      </motion.div>

      {/* Journey Display */}
      <AnimatePresence mode="wait">
        {journeyData && (
          <motion.div
            key="journey"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            {/* Vial Info Card */}
            <div className="card">
              <div className="flex items-start justify-between mb-6">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <Package className="w-8 h-8 text-maroon dark:text-ochre" />
                    <div>
                      <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                        {journeyData.vial.drug_name}
                      </h3>
                      <p className="font-mono text-sm text-maroon dark:text-ochre">
                        {journeyData.vial.asset_id}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Category</p>
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {journeyData.vial.category || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Batch Number</p>
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {journeyData.vial.batch_number}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Expiry Date</p>
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {new Date(journeyData.vial.expiry_date).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Current Status</p>
                      <span className={`badge ${getStatusColor(journeyData.vial.status)}`}>
                        {journeyData.vial.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div className="card">
              <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-maroon dark:text-ochre" />
                Journey Timeline
              </h3>

              <div className="relative">
                {/* Timeline Line */}
                <div className="absolute left-[19px] top-8 bottom-8 w-0.5 bg-gradient-to-b from-green-500 via-blue-500 to-gray-300 dark:to-gray-600"></div>

                {/* Timeline Events */}
                <div className="space-y-8">
                  {journeyData.timeline.map((event, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1, duration: 0.4 }}
                      className="relative pl-14"
                    >
                      {/* Event Icon */}
                      <div
                        className={`absolute left-0 w-10 h-10 rounded-full ${getEventColor(
                          event.type
                        )} flex items-center justify-center text-white shadow-lg`}
                      >
                        {getEventIcon(event.type)}
                      </div>

                      {/* Event Card */}
                      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h4 className="font-semibold text-lg text-gray-900 dark:text-gray-100">
                              {event.title}
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {new Date(event.timestamp).toLocaleString()}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                          <div className="flex items-center gap-2 text-sm">
                            <MapPin className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-700 dark:text-gray-300">
                              {event.location}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <User className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-700 dark:text-gray-300">
                              {event.user}
                            </span>
                          </div>
                        </div>

                        {/* Event Details */}
                        {event.details && Object.keys(event.details).length > 0 && (
                          <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                            <div className="flex items-center gap-1 mb-2">
                              <FileText className="w-4 h-4 text-gray-400" />
                              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                                Details
                              </span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {Object.entries(event.details).map(([key, value]) => (
                                <div key={key} className="text-sm">
                                  <span className="text-gray-500 dark:text-gray-400">{key}:</span>{' '}
                                  <span className="text-gray-900 dark:text-gray-100 font-medium">
                                    {value || 'N/A'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty State */}
      {!journeyData && !searching && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="card text-center py-16"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full mb-4">
            <Search className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Search for an Asset
          </h3>
          <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
            Enter an Asset ID above to view the complete journey and timeline of any medication vial
            in the system
          </p>
        </motion.div>
      )}
    </div>
  )
}

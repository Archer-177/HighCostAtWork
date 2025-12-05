import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    FileText, CheckCircle, AlertTriangle, XCircle, X,
    Truck, Package, ArrowRight, Calendar, Hash, Pill, CheckSquare,
    Search, Filter, Clock, MapPin, User
} from 'lucide-react'
import { format } from 'date-fns'
import { useNotification } from '../contexts/NotificationContext'

export default function StockJourney() {
    const { error: showError } = useNotification()

    // Search State
    const [query, setQuery] = useState('')
    const [statusFilter, setStatusFilter] = useState('ALL')
    const [isSearching, setIsSearching] = useState(false)
    const [searchResults, setSearchResults] = useState([])

    // Journey State
    const [selectedAssetId, setSelectedAssetId] = useState(null)
    const [journeyData, setJourneyData] = useState(null)
    const [loadingJourney, setLoadingJourney] = useState(false)

    // Handle Search
    const handleSearch = async (e) => {
        e?.preventDefault()
        // Allow search if query is empty but filter is not ALL, or if query is present
        if (!query && statusFilter === 'ALL') {
            setSearchResults([])
            return
        }

        setIsSearching(true)
        setSelectedAssetId(null)
        setJourneyData(null)

        try {
            const response = await fetch(`/api/stock_search?query=${encodeURIComponent(query)}&status=${statusFilter}`)
            const data = await response.json()
            setSearchResults(data)
        } catch (err) {
            showError('Search Failed', 'Could not fetch search results')
        } finally {
            setIsSearching(false)
        }
    }

    // Auto-search when filter changes
    useEffect(() => {
        handleSearch()
    }, [statusFilter])

    const clearSearch = () => {
        setQuery('')
        if (statusFilter === 'ALL') {
            setSearchResults([])
        } else {
            // If filter is active, re-search with empty query
            // The useEffect will handle this if we don't call handleSearch here, 
            // but since query state update is async, we might need to rely on the next render or pass empty string explicitly.
            // Actually, setting query triggers re-render, but handleSearch uses current state 'query'.
            // Better to let user manually trigger text search or just wait for filter?
            // User asked for "X to clear search bar". Usually this implies resetting results if no filter.
        }
    }

    // Handle Asset Selection
    const loadJourney = async (assetId) => {
        setLoadingJourney(true)
        setSelectedAssetId(assetId)

        try {
            const response = await fetch(`/api/stock_journey/${assetId}`)
            if (response.ok) {
                const data = await response.json()
                setJourneyData(data)
            } else {
                showError('Error', 'Failed to load journey details')
            }
        } catch (err) {
            showError('Connection Error', 'Could not fetch journey data')
        } finally {
            setLoadingJourney(false)
        }
    }

    // Status Badge Helper
    const getStatusBadge = (status) => {
        const styles = {
            'AVAILABLE': 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800',
            'USED_CLINICAL': 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800',
            'DISCARDED': 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800',
            'IN_TRANSIT': 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800'
        }
        return styles[status] || 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600'
    }

    return (
        <div className="min-h-screen p-6 space-y-8">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
            >
                <h1 className="text-4xl font-display tracking-wider gradient-text mb-2">
                    Stock Journey
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                    Track the complete lifecycle of any medicine vial across the network
                </p>
            </motion.div>

            {/* Search Section */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6"
            >
                <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1 relative">
                        <Search className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search by Asset ID, Drug Name, or Batch Number..."
                            className="w-full pl-12 pr-12 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl
                       focus:outline-none focus:border-maroon-500 focus:bg-white dark:focus:bg-gray-600 transition-all dark:text-white"
                        />
                        {query && (
                            <button
                                type="button"
                                onClick={() => setQuery('')}
                                className="absolute right-4 top-3.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        )}
                    </div>

                    <div className="w-full md:w-48 relative">
                        <Filter className="absolute left-4 top-3.5 w-5 h-5 text-gray-400 pointer-events-none" />
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="w-full pl-12 pr-10 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl
                       appearance-none focus:outline-none focus:border-maroon-500 focus:bg-white dark:focus:bg-gray-600 
                       transition-all cursor-pointer dark:text-white"
                        >
                            <option value="ALL">All Status</option>
                            <option value="AVAILABLE">Available</option>
                            <option value="USED_CLINICAL">Used</option>
                            <option value="DISCARDED">Discarded</option>
                            <option value="IN_TRANSIT">In Transit</option>
                        </select>
                    </div>

                    <button
                        type="submit"
                        disabled={isSearching}
                        className="px-8 py-3 bg-gradient-to-r from-maroon-600 to-maroon-800 text-white 
                     font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 
                     transition-all disabled:opacity-50"
                    >
                        {isSearching ? 'Searching...' : 'Track'}
                    </button>
                </form>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Results List */}
                {/* Results List */}
                <div className="lg:col-span-1 space-y-4">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Search className="w-5 h-5" />
                        Search Results
                        <span className="text-sm font-normal text-gray-500">({searchResults.length})</span>
                    </h2>

                    <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                        {searchResults.length === 0 && !isSearching && (
                            <div className="text-center py-8 text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                                <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                <p>No items found</p>
                            </div>
                        )}

                        {searchResults.map(item => (
                            <motion.div
                                key={item.id}
                                layoutId={`card-${item.id}`}
                                onClick={() => loadJourney(item.asset_id)}
                                className={`p-4 rounded-xl border cursor-pointer transition-all
                  ${selectedAssetId === item.asset_id
                                        ? 'bg-maroon-50 dark:bg-maroon-900/20 border-maroon-200 dark:border-maroon-800 shadow-md ring-1 ring-maroon-200 dark:ring-maroon-800'
                                        : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:border-maroon-100 dark:hover:border-gray-600 hover:shadow-sm'}`}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <span className="font-mono text-xs font-bold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                                        {item.asset_id}
                                    </span>
                                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${getStatusBadge(item.status)}`}>
                                        {item.status}
                                    </span>
                                </div>
                                <h3 className="font-bold text-gray-900 dark:text-white mb-1">{item.drug_name}</h3>
                                <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                                    <div className="flex items-center gap-1">
                                        <MapPin className="w-3 h-3" />
                                        {item.location_name}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Hash className="w-3 h-3" />
                                        Batch: {item.batch_number}
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>

                {/* Journey Timeline */}
                <div className="lg:col-span-2">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                        <Clock className="w-5 h-5" />
                        Item Timeline
                    </h2>

                    {!journeyData ? (
                        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-12 text-center text-gray-400">
                            <div className="w-16 h-16 bg-gray-50 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                                <ArrowRight className="w-8 h-8 opacity-20" />
                            </div>
                            <p className="text-lg font-medium">Select an item to view its journey</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Header Card */}
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 relative overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 p-6 opacity-10">
                                    <Pill className="w-32 h-32 text-maroon-900" />
                                </div>

                                <div className="relative z-10">
                                    <div className="flex items-center gap-3 mb-4">
                                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{journeyData.vial.drug_name}</h2>
                                        <span className={`px-3 py-1 rounded-full text-sm font-bold border ${getStatusBadge(journeyData.vial.status)}`}>
                                            {journeyData.vial.status}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                        <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                            <span className="block text-gray-500 dark:text-gray-400 text-xs mb-1">Asset ID</span>
                                            <span className="font-mono font-bold dark:text-white">{journeyData.vial.asset_id}</span>
                                        </div>
                                        <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                            <span className="block text-gray-500 dark:text-gray-400 text-xs mb-1">Batch Number</span>
                                            <span className="font-mono font-bold dark:text-white">{journeyData.vial.batch_number}</span>
                                        </div>
                                        <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                            <span className="block text-gray-500 dark:text-gray-400 text-xs mb-1">Expiry Date</span>
                                            <span className="font-bold dark:text-white">{journeyData.vial.expiry_date}</span>
                                        </div>
                                        <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                            <span className="block text-gray-500 dark:text-gray-400 text-xs mb-1">Storage</span>
                                            <span className="font-bold dark:text-white">{journeyData.vial.storage_temp}</span>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>

                            {/* Timeline */}
                            <div className="relative pl-8 space-y-8 before:content-[''] before:absolute before:left-3.5 
                            before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200 dark:before:bg-gray-700">
                                {journeyData.timeline.map((event, index) => (
                                    <motion.div
                                        key={index}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: index * 0.1 }}
                                        className="relative"
                                    >
                                        {/* Timeline Dot */}
                                        <div className={`absolute -left-[2.35rem] w-8 h-8 rounded-full border-4 border-white dark:border-gray-800 shadow-sm flex items-center justify-center
                      ${event.type === 'CREATED' ? 'bg-emerald-500' :
                                                event.type === 'USED' ? 'bg-blue-500' :
                                                    event.type === 'DISCARDED' ? 'bg-red-500' :
                                                        event.type === 'TRANSFER_COMPLETED' ? 'bg-purple-500' :
                                                            'bg-amber-500'}`}
                                        >
                                            {event.type === 'CREATED' && <Package className="w-4 h-4 text-white" />}
                                            {event.type === 'USED' && <CheckCircle className="w-4 h-4 text-white" />}
                                            {event.type === 'DISCARDED' && <XCircle className="w-4 h-4 text-white" />}
                                            {event.type === 'TRANSFER_STARTED' && <Truck className="w-4 h-4 text-white" />}
                                            {event.type === 'TRANSFER_COMPLETED' && <CheckSquare className="w-4 h-4 text-white" />}
                                        </div>

                                        {/* Content Card */}
                                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 hover:shadow-md transition-shadow">
                                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-3">
                                                <div>
                                                    <h3 className="font-bold text-gray-900 dark:text-white">
                                                        {event.title === 'Stock Received' ? 'Stock Received from Supplier' : event.title}
                                                    </h3>
                                                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                                                        <Clock className="w-3.5 h-3.5" />
                                                        {format(new Date(event.timestamp), 'PPpp')}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 px-3 py-1 rounded-full">
                                                    <User className="w-3.5 h-3.5" />
                                                    {event.user}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-4">
                                                <MapPin className="w-4 h-4 text-gray-400" />
                                                {event.location}
                                            </div>

                                            {/* Details Grid */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-gray-50 dark:bg-gray-700 rounded-lg p-4 text-sm">
                                                {Object.entries(event.details).map(([key, value]) => (
                                                    value && (
                                                        <div key={key}>
                                                            <span className="text-gray-500 dark:text-gray-400 text-xs block">{key}</span>
                                                            <span className="font-medium text-gray-900 dark:text-white">{value}</span>
                                                        </div>
                                                    )
                                                ))}
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

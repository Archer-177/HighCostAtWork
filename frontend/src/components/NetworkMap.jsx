// Import necessary React hooks and animation library
import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Building2, MapPin, Heart, AlertTriangle, CheckCircle, Truck, Info } from 'lucide-react'

/**
 * NetworkMap Component
 * Displays an interactive map of all locations in the pharmacy network
 * 
 * @param {Function} onSelectLocation - Callback when a location is clicked
 * @param {string} fromLocationId - ID of the source location for transfers
 * @param {string} toLocationId - ID of the destination location for transfers
 * @param {Array} validTargetIds - Array of location IDs that are valid transfer targets
 */
export default function NetworkMap({ onSelectLocation, fromLocationId, toLocationId, validTargetIds }) {
    // State for storing all location data from the API
    const [locations, setLocations] = useState([])
    // State for tracking stock health status at each location (healthy/warning/critical)
    const [stockStatus, setStockStatus] = useState({})
    // Loading state while fetching data
    const [loading, setLoading] = useState(true)

    // State for view mode: 'expiry' or 'level'
    const [viewMode, setViewMode] = useState('expiry')
    // State for hover tooltips
    const [hoveredNode, setHoveredNode] = useState(null)

    // Fetch location and stock data when component mounts
    useEffect(() => {
        fetchData()
    }, [])

    /**
     * Fetches location and stock status data from the API
     * Uses Promise.all to fetch both endpoints in parallel for better performance
     */
    const fetchData = async () => {
        try {
            // Fetch locations and stock data simultaneously
            const [locRes, stockRes] = await Promise.all([
                fetch('/api/locations'),
                fetch('/api/stock/all')
            ])

            const locData = await locRes.json()
            const stockData = await stockRes.json()

            // Only update state if both requests were successful
            if (locRes.ok && stockRes.ok) {
                setLocations(locData)
                setStockStatus(stockData)
            }
        } catch (err) {
            console.error("Failed to load map data")
        } finally {
            // Always stop loading, even if there was an error
            setLoading(false)
        }
    }

    // Filter locations to get only hub locations (Port Augusta and Whyalla)
    const hubs = locations.filter(l => l.type === 'HUB')
    // Helper function to get all child locations (wards/remotes) for a specific hub
    const getChildren = (hubId) => locations.filter(l => l.parent_hub_id === hubId)

    /**
     * Node Component - Renders a single location node on the map
     * 
     * @param {Object} location - Location data object
     * @param {boolean} isHub - Whether this node represents a hub location
     */
    const Node = ({ location, isHub = false }) => {
        // Get stock status for this location (default to 'healthy' if not found)
        // Now handles the structured object { expiry: '...', level: '...' }
        const statusObj = stockStatus[location.id] || { expiry: 'healthy', level: 'healthy' }
        const status = statusObj[viewMode] || 'healthy'

        // Determine indicator color based on stock status
        let color = 'bg-emerald-500'
        let pulseIntensity = ''

        if (viewMode === 'level') {
            // Binary state for Stock Levels: Red (Low/Critical) vs Green (Adequate)
            // Assuming 'critical' is below min. 'warning' might be close to min but above.
            // User said: "at or above min ... green".
            if (status === 'critical') {
                color = 'bg-red-500'
                pulseIntensity = 'animate-pulse'
            } else {
                // healthy or warning (both considered adequate/above min)
                color = 'bg-emerald-500'
            }
        } else {
            // Expiry view (3 states)
            color = status === 'critical' ? 'bg-red-500' : status === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'
            pulseIntensity = status === 'critical' ? 'animate-pulse' : ''
        }

        // Check if this location is the source of the current transfer
        const isFrom = fromLocationId === location.id.toString()
        // Check if this location is the destination of the current transfer
        const isTo = toLocationId === location.id.toString()

        // Determine if this node is a valid target for selection
        // - If no source selected yet, all locations are valid (for selecting source)
        // - If source is selected, only valid target locations are clickable
        // - The source location itself is always valid (to allow deselection)
        const isValid = !fromLocationId || (validTargetIds && validTargetIds.includes(location.id.toString())) || isFrom

        // Show if this is a valid unselected target (for glow effect)
        const isValidTarget = fromLocationId && !isFrom && !isTo && isValid

        // Apply visual ring highlighting for selected locations
        let ringClass = ''
        if (isFrom) ringClass = 'ring-4 ring-blue-500 ring-offset-2'  // Blue ring for source
        else if (isTo) ringClass = 'ring-4 ring-maroon-500 ring-offset-2'  // Maroon ring for destination

        // Add glow effect for valid selectable targets
        const glowClass = isValidTarget ? 'shadow-lg shadow-emerald-400/50 border-2 border-emerald-300' : ''

        const isHovered = hoveredNode === location.id

        return (
            <div className="relative">
                <motion.div
                    // Animate on hover/tap only if the node is valid for selection
                    whileHover={isValid ? { scale: 1.1 } : {}}
                    whileTap={isValid ? { scale: 0.95 } : {}}
                    onClick={() => isValid && onSelectLocation(location.id)}
                    onMouseEnter={() => setHoveredNode(location.id)}
                    onMouseLeave={() => setHoveredNode(null)}
                    className={`relative flex flex-col items-center p-4 rounded-xl transition-all duration-300
                        ${(isFrom || isTo) ? 'bg-white shadow-xl z-10 ' + ringClass : 'bg-white/80 shadow-sm'}
                        ${isValid ? 'cursor-pointer hover:bg-white' : 'opacity-40 grayscale cursor-not-allowed'}
                        ${glowClass}
                    `}
                >
                    {/* Stock status indicator - pulsing dot in top-right corner */}
                    <div className={`w-3 h-3 rounded-full absolute top-2 right-2 ${color} ${pulseIntensity}`} />

                    {/* Choose icon based on location type: Building for Hub, Heart for Ward, MapPin for Remote */}
                    {isHub ? <Building2 className="w-8 h-8 text-maroon-700 mb-2" /> :
                        location.type === 'WARD' ? <Heart className="w-6 h-6 text-pink-600 mb-2" /> :
                            <MapPin className="w-6 h-6 text-blue-600 mb-2" />}

                    {/* Display shortened location name */}
                    <span className="text-xs font-bold text-center max-w-[100px] leading-tight">
                        {location.name.replace('Hospital Pharmacy', '').replace('Hospital', '')}
                    </span>

                    {/* Show FROM/TO badges for selected locations with improved visibility */}
                    {isFrom && <span className="absolute -bottom-7 text-[11px] font-bold bg-blue-500 text-white px-3 py-1 rounded-full shadow-md z-20">FROM</span>}
                    {isTo && <span className="absolute -bottom-7 text-[11px] font-bold bg-maroon-600 text-white px-3 py-1 rounded-full shadow-md z-20">TO</span>}
                </motion.div>

                {/* Hover Tooltip */}
                <AnimatePresence>
                    {isHovered && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs rounded-lg p-3 shadow-xl z-50 min-w-[180px] pointer-events-none"
                        >
                            <div className="font-bold mb-1">{location.name}</div>
                            <div className="text-gray-300 space-y-0.5">
                                <div className="flex items-center gap-1">
                                    <div className={`w-2 h-2 rounded-full ${color}`} />
                                    <span className="capitalize">
                                        {viewMode === 'expiry' ? 'Expiry: ' + status :
                                            status === 'critical' ? 'Low Stock' : 'Adequate Stock'}
                                    </span>
                                </div>
                            </div>
                            {/* Tooltip arrow */}
                            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45" />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        )
    }

    // Show loading state while fetching data
    if (loading) return <div className="h-64 flex items-center justify-center">Loading Network Map...</div>

    // Main render - network map with hub-and-spoke layout
    return (
        <div className="bg-sand-50 p-8 rounded-3xl overflow-hidden relative min-h-[500px]">
            {/* Decorative background pattern */}
            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#8A2A2B_1px,transparent_1px)] [background-size:16px_16px]" />

            {/* View Mode Toggle - Bottom Right */}
            <div className="absolute bottom-4 right-4 z-20 bg-white/90 backdrop-blur rounded-lg shadow-sm border border-gray-200 p-1 flex gap-1">
                <button
                    onClick={() => setViewMode('expiry')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === 'expiry'
                        ? 'bg-maroon-100 text-maroon-800 shadow-sm'
                        : 'text-gray-600 hover:bg-gray-50'
                        }`}
                >
                    Expiry Status
                </button>
                <button
                    onClick={() => setViewMode('level')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === 'level'
                        ? 'bg-maroon-100 text-maroon-800 shadow-sm'
                        : 'text-gray-600 hover:bg-gray-50'
                        }`}
                >
                    Stock Levels
                </button>
            </div>

            {/* Main grid layout - one column per hub */}
            <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-12 mt-8">
                {hubs.map(hub => (
                    <div key={hub.id} className="bg-white/50 backdrop-blur-sm rounded-3xl p-6 border border-white/20">
                        {/* Render hub at the top */}
                        <div className="flex justify-center mb-8">
                            <Node location={hub} isHub={true} />
                        </div>

                        {/* Connection lines and child locations */}
                        <div className="grid grid-cols-3 gap-4 relative">
                            {/* Horizontal line connecting to all children */}
                            <div className="absolute top-0 left-0 right-0 h-px bg-gray-300 -translate-y-4" />

                            {/* Render all child locations (wards/remotes) for this hub */}
                            {getChildren(hub.id).map(child => (
                                <div key={child.id} className="flex flex-col items-center relative pt-4">
                                    {/* Vertical line connecting child to horizontal line */}
                                    <div className="absolute top-0 w-px h-4 bg-gray-300 -translate-y-4" />
                                    <Node location={child} />
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* Legend - Bottom Left */}
            <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 px-4 py-3 z-20">
                <div className="flex items-center gap-4">
                    {viewMode === 'expiry' ? (
                        <>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                                <span className="text-xs font-medium text-gray-700">&gt;90d</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-amber-500" />
                                <span className="text-xs font-medium text-gray-700">30-90d</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-red-500" />
                                <span className="text-xs font-medium text-gray-700">&lt;30d</span>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                                <span className="text-xs font-medium text-gray-700">Adequate Stock</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-red-500" />
                                <span className="text-xs font-medium text-gray-700">Low Stock</span>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}

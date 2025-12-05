import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Search,
    ThermometerSnowflake,
    ThermometerSun,
    ShieldAlert,
    Save,
    Filter,
    AlertCircle,
    Loader2,
    XCircle
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useNotification } from '../contexts/NotificationContext'

export default function StockLevelsSettings() {
    const { user } = useAuth()
    const { success, error: showError } = useNotification()

    // --- STATE ---
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    // Data
    const [locations, setLocations] = useState([])
    const [drugs, setDrugs] = useState([])
    const [stockLevels, setStockLevels] = useState([]) // Array of { location_id, drug_id, min_stock }

    // Local State
    const [unsavedChanges, setUnsavedChanges] = useState({}) // { "locationId_drugId": newValue }

    // Filters
    const [searchQuery, setSearchQuery] = useState('')
    const [groupFilter, setGroupFilter] = useState('All')
    const [storageFilter, setStorageFilter] = useState('all') // 'all', 'fridge', 'ambient'

    // --- INITIALIZATION ---
    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        try {
            const [locationsRes, drugsRes, levelsRes] = await Promise.all([
                fetch('/api/locations'),
                fetch('/api/drugs'),
                fetch('/api/stock_levels')
            ])

            const locationsData = await locationsRes.json()
            const drugsData = await drugsRes.json()
            const levelsData = await levelsRes.json()

            // Sort locations: Hubs first, then others
            const sortedLocations = locationsData.sort((a, b) => {
                if (a.type === 'HUB' && b.type !== 'HUB') return -1
                if (a.type !== 'HUB' && b.type === 'HUB') return 1
                return a.name.localeCompare(b.name)
            })

            setLocations(sortedLocations)
            setDrugs(drugsData)
            setStockLevels(levelsData)
        } catch (err) {
            showError('Load Error', 'Failed to load stock levels')
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    // --- DERIVED DATA & FILTERING ---

    // 1. Create a lookup map for current saved levels: levelsMap[locationId][drugId] = min_stock
    const levelsMap = useMemo(() => {
        const map = {}
        stockLevels.forEach(level => {
            if (!map[level.location_id]) map[level.location_id] = {}
            map[level.location_id][level.drug_id] = level.min_stock
        })
        return map
    }, [stockLevels])

    // 2. Filter Drugs
    const filteredDrugs = useMemo(() => {
        return drugs.filter(drug => {
            const matchesSearch = drug.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (drug.category && drug.category.toLowerCase().includes(searchQuery.toLowerCase()))

            const matchesGroup = groupFilter === 'All' || drug.category === groupFilter

            // Determine storage type (Fridge vs Ambient)
            // Using logic similar to Dashboard: '2-8' implies Fridge
            const isFridge = drug.storage_temp?.includes('2-8') || drug.is_fridge

            const matchesStorage = storageFilter === 'all' ||
                (storageFilter === 'fridge' && isFridge) ||
                (storageFilter === 'ambient' && !isFridge)

            return matchesSearch && matchesGroup && matchesStorage
        })
    }, [drugs, searchQuery, groupFilter, storageFilter])

    // 3. Group Drugs
    const groupedDrugs = useMemo(() => {
        const groups = {}
        filteredDrugs.forEach(drug => {
            const groupName = drug.category || 'Uncategorized'
            if (!groups[groupName]) groups[groupName] = []
            groups[groupName].push(drug)
        })
        return groups
    }, [filteredDrugs])

    const sortedGroupKeys = Object.keys(groupedDrugs).sort()
    const uniqueGroups = useMemo(() => [...new Set(drugs.map(d => d.category || 'Uncategorized'))].sort(), [drugs])

    // --- HANDLERS ---

    const getStockValue = (locationId, drugId) => {
        const key = `${locationId}_${drugId}`
        if (unsavedChanges.hasOwnProperty(key)) {
            return unsavedChanges[key]
        }
        return levelsMap[locationId]?.[drugId] || 0
    }

    const isModified = (locationId, drugId) => {
        return unsavedChanges.hasOwnProperty(`${locationId}_${drugId}`)
    }

    const handleStockChange = (locationId, drugId, value) => {
        const cleanValue = parseInt(value)
        if (isNaN(cleanValue) || cleanValue < 0) return

        const key = `${locationId}_${drugId}`
        const originalValue = levelsMap[locationId]?.[drugId] || 0

        if (cleanValue === originalValue) {
            // Reverted to original, remove from unsaved
            setUnsavedChanges(prev => {
                const next = { ...prev }
                delete next[key]
                return next
            })
        } else {
            setUnsavedChanges(prev => ({
                ...prev,
                [key]: cleanValue
            }))
        }
    }

    const saveChanges = async () => {
        setSaving(true)
        try {
            // Convert unsavedChanges object back to array of updates
            const updates = Object.entries(unsavedChanges).map(([key, min_stock]) => {
                const [locationId, drugId] = key.split('_').map(Number)
                return { location_id: locationId, drug_id: drugId, min_stock }
            })

            const response = await fetch('/api/stock_levels', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ updates })
            })

            if (response.ok) {
                success('Saved', 'Stock levels updated successfully')
                setUnsavedChanges({})
                fetchData() // Refresh data to confirm sync
            } else {
                showError('Error', 'Failed to update stock levels')
            }
        } catch (err) {
            showError('Connection Error', 'Failed to save changes')
        } finally {
            setSaving(false)
        }
    }

    // --- RENDER ---

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-sand-50">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 text-maroon-600 animate-spin" />
                    <p className="text-maroon-800 font-medium">Loading Matrix...</p>
                </div>
            </div>
        )
    }

    // Access Control
    if (user?.role !== 'PHARMACIST') {
        return (

            <div className="flex items-center justify-center h-screen bg-sand-50 dark:bg-gray-900">
                <div className="text-center p-8 bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-maroon-100 dark:border-gray-700">
                    <AlertCircle className="w-16 h-16 text-maroon-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Access Denied</h2>
                    <p className="text-gray-600 dark:text-gray-400 mt-2">Only pharmacists can manage minimum stock levels.</p>
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-screen bg-sand-50 dark:bg-gray-900 text-slate-900 dark:text-white font-sans overflow-hidden p-6">

            {/* 1. HEADER (Standard App Style) */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 flex-none"
            >
                <h1 className="text-4xl font-display tracking-wider gradient-text mb-2">
                    Minimum Stock Levels
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                    Manage stock thresholds across all sites to trigger automatic alerts
                </p>
            </motion.div>

            {/* 2. FILTERS & CONTROLS (Single Line) */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 mb-6 flex-none flex flex-wrap items-center gap-4 z-20">

                {/* Search */}
                <div className="relative flex-1 min-w-[300px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search drug name or category..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-10 py-2.5 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-xl focus:outline-none 
                                 focus:ring-2 focus:ring-maroon-500 focus:border-transparent transition-all dark:text-white"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full transition-colors"
                        >
                            <XCircle className="w-4 h-4 text-gray-400" />
                        </button>
                    )}
                </div>

                <div className="h-8 w-px bg-gray-200 dark:bg-gray-700 mx-2 hidden md:block"></div>

                {/* Storage Filter */}
                <div className="flex bg-gray-50 dark:bg-gray-700 p-1 rounded-xl border border-gray-100 dark:border-gray-600">
                    <button
                        onClick={() => setStorageFilter('all')}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${storageFilter === 'all' ? 'bg-white dark:bg-gray-600 shadow-sm text-maroon-700 dark:text-maroon-300' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                    >
                        All
                    </button>
                    <button
                        onClick={() => setStorageFilter('fridge')}
                        className={`px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2 transition-all ${storageFilter === 'fridge' ? 'bg-white dark:bg-gray-600 shadow-sm text-blue-700 dark:text-blue-300' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                    >
                        <ThermometerSnowflake className="w-4 h-4" />
                        <span>Fridge</span>
                    </button>
                    <button
                        onClick={() => setStorageFilter('ambient')}
                        className={`px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2 transition-all ${storageFilter === 'ambient' ? 'bg-white dark:bg-gray-600 shadow-sm text-orange-700 dark:text-orange-300' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                    >
                        <ThermometerSun className="w-4 h-4" />
                        <span>Shelf</span>
                    </button>
                </div>

                {/* Group Filter */}
                <div className="relative min-w-[200px]">
                    <select
                        value={groupFilter}
                        onChange={(e) => setGroupFilter(e.target.value)}
                        className="w-full pl-4 pr-10 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl
                                 focus:outline-none focus:border-maroon-500 focus:bg-white dark:focus:bg-gray-600 transition-all appearance-none cursor-pointer text-sm font-medium text-gray-700 dark:text-white"
                    >
                        <option value="All">All Categories</option>
                        {uniqueGroups.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                    <Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>

                <div className="text-xs text-gray-400 font-mono ml-auto">
                    {filteredDrugs.length} items
                </div>
            </div>

            {/* 3. MATRIX GRID */}
            <div className="flex-1 overflow-auto bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 relative">
                <table className="w-full border-collapse min-w-[1200px]">
                    <thead className="sticky top-0 z-20 shadow-sm">
                        <tr className="bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider h-12">
                            {/* Sticky Corner */}
                            <th className="sticky left-0 bg-gray-50 dark:bg-gray-700 z-30 text-left pl-6 pr-4 w-64 border-b border-r border-gray-200 dark:border-gray-600 font-semibold shadow-[4px_0_12px_-4px_rgba(0,0,0,0.05)]">
                                Drug Details
                            </th>
                            <th className="w-32 px-2 text-center border-b border-gray-200 dark:border-gray-600 border-r">Storage</th>

                            {/* Location Columns */}
                            {locations.map(loc => (
                                <th key={loc.id} className={`px-2 text-center border-b border-gray-200 dark:border-gray-600 border-r min-w-[100px] ${loc.type === 'HUB' ? 'bg-maroon-50/30 dark:bg-maroon-900/20 text-maroon-800 dark:text-maroon-300 font-bold' : ''}`}>
                                    <div className="flex flex-col items-center justify-center">
                                        <span>{loc.name}</span>
                                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full mt-1 ${loc.type === 'HUB' ? 'bg-maroon-100 dark:bg-maroon-900/40 text-maroon-700 dark:text-maroon-300' : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'}`}>
                                            {loc.type}
                                        </span>
                                    </div>
                                </th>
                            ))}
                        </tr>

                    </thead>
                    <tbody className="bg-white dark:bg-gray-800">
                        {sortedGroupKeys.map(group => (
                            <React.Fragment key={group}>
                                {/* Group Header */}
                                <tr className="bg-gray-50/50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700">
                                    <td colSpan={2 + locations.length} className="sticky left-0 z-10 bg-gray-50/95 dark:bg-gray-700/95 backdrop-blur-sm px-6 py-2 border-b border-gray-100 dark:border-gray-700">
                                        <div className="flex items-center space-x-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-maroon-400"></div>
                                            <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-widest">{group}</span>
                                            <span className="text-xs text-gray-400 font-normal">({groupedDrugs[group].length})</span>
                                        </div>
                                    </td>
                                </tr>

                                {/* Drug Rows */}
                                {groupedDrugs[group].map(drug => {
                                    // Determine storage display based on Dashboard logic
                                    const isFridge = drug.storage_temp?.includes('2-8') || drug.is_fridge

                                    return (
                                        <tr key={drug.id} className="hover:bg-blue-50/30 dark:hover:bg-gray-700/30 group transition-colors h-14 border-b border-gray-100 dark:border-gray-700">
                                            {/* Sticky Name Column */}
                                            <td className="sticky left-0 bg-white dark:bg-gray-800 group-hover:bg-blue-50/30 dark:group-hover:bg-gray-700/30 z-10 pl-6 pr-4 py-2 border-r border-gray-200 dark:border-gray-700 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.02)]">
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-gray-900 dark:text-gray-100 text-sm truncate max-w-[220px]" title={drug.name}>
                                                        {drug.name}
                                                    </span>
                                                    <span className="text-xs text-gray-500 dark:text-gray-400 truncate">{drug.category}</span>
                                                </div>
                                            </td>

                                            {/* Storage Type */}
                                            {/* Storage Type */}
                                            <td className="text-center py-2 border-r border-gray-100 dark:border-gray-700">
                                                {isFridge ? (
                                                    <div className="inline-flex items-center gap-1.5">
                                                        <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 8h6m-5 0a3 3 0 110 6H9l3 3m-3-6h6m6 1a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                        </svg>
                                                        <span className="text-xs font-medium text-blue-700 dark:text-blue-300">2-8°C</span>
                                                    </div>
                                                ) : (
                                                    <div className="inline-flex items-center gap-1.5">
                                                        <svg className="w-4 h-4 text-orange-600 dark:text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                                        </svg>
                                                        <span className="text-xs font-medium text-orange-700 dark:text-orange-300">&lt;25°C</span>
                                                    </div>
                                                )}
                                            </td>

                                            {/* Stock Level Inputs */}
                                            {locations.map(loc => {
                                                const value = getStockValue(loc.id, drug.id)
                                                const modified = isModified(loc.id, drug.id)

                                                return (
                                                    <td key={loc.id} className={`p-0 border-r border-gray-100 dark:border-gray-700 text-center relative ${loc.type === 'HUB' ? 'bg-maroon-50/5 dark:bg-maroon-900/5' : ''}`}>
                                                        <div className="h-full w-full p-2 flex items-center justify-center">
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                value={value}
                                                                onChange={(e) => handleStockChange(loc.id, drug.id, e.target.value)}
                                                                className={`w-16 text-center text-sm p-1.5 rounded-lg border transition-all focus:outline-none focus:ring-2 focus:ring-maroon-500 font-mono
                                                                    ${modified
                                                                        ? 'bg-amber-50 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-300 font-bold shadow-sm'
                                                                        : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:border-gray-300 dark:hover:border-gray-500'
                                                                    }`}
                                                            />
                                                        </div>
                                                    </td>
                                                )
                                            })}
                                        </tr>
                                    )
                                })}
                            </React.Fragment>
                        ))}

                        {/* Empty State */}
                        {sortedGroupKeys.length === 0 && (
                            <tr>
                                <td colSpan={2 + locations.length} className="py-20 text-center text-gray-400">
                                    <div className="flex flex-col items-center justify-center space-y-3">
                                        <Search className="w-12 h-12 opacity-20" />
                                        <p className="text-lg font-medium">No items found</p>
                                        <p className="text-sm">Try adjusting your filters</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div >

            {/* 4. UNSAVED CHANGES FLOATING BAR */}
            < AnimatePresence >
                {
                    Object.keys(unsavedChanges).length > 0 && (
                        <motion.div
                            initial={{ y: 100, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 100, opacity: 0 }}
                            className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-50"
                        >
                            <div className="bg-gray-900 text-white pl-6 pr-2 py-2 rounded-full shadow-2xl flex items-center space-x-6 border border-gray-700">
                                <div className="flex items-center space-x-3">
                                    <ShieldAlert className="w-5 h-5 text-amber-400 animate-pulse" />
                                    <span className="text-sm font-medium">
                                        {Object.keys(unsavedChanges).length} unsaved updates
                                    </span>
                                </div>
                                <button
                                    onClick={saveChanges}
                                    disabled={saving}
                                    className="bg-gradient-to-r from-maroon-600 to-maroon-700 hover:from-maroon-500 hover:to-maroon-600 
                                         text-white px-6 py-2.5 rounded-full text-sm font-bold transition-all 
                                         flex items-center shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {saving ? (
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    ) : (
                                        <Save className="w-4 h-4 mr-2" />
                                    )}
                                    {saving ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </motion.div>
                    )
                }
            </AnimatePresence >
        </div >
    )
}

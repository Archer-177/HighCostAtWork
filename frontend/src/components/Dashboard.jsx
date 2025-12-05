import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Heart, Pill, AlertTriangle, CheckCircle, Clock, TrendingDown,
  Package, Building2, MapPin, Search, Filter, Scan, AlertCircle,
  LayoutGrid, List, XCircle
} from 'lucide-react'
import { format } from 'date-fns'
import useAppStore from '../stores/appStore';
import { useNotification } from '../contexts/NotificationContext';
import StockCard from './StockCard';
import QRScanner from './QRScanner';

export default function Dashboard() {
  const user = useAppStore((state) => state.user);
  const { success, error: showError } = useNotification();
  const [dashboardData, setDashboardData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterLocation, setFilterLocation] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [showScanner, setShowScanner] = useState(false)
  const [viewMode, setViewMode] = useState('grid')
  const [groupingMode, setGroupingMode] = useState('grouped')
  const [collapsedGroups, setCollapsedGroups] = useState(new Set())

  const handleScan = (decodedText) => {
    setSearchTerm(decodedText)
    setGroupingMode('ungrouped') // Switch to list view to show result directly
    setShowScanner(false)
    success('Item Found', `Filtered dashboard for ${decodedText}`)
  }

  // Physical Scanner Listener
  useEffect(() => {
    let buffer = ''
    let lastKeyTime = Date.now()

    const handleKeyDown = (e) => {
      const currentTime = Date.now()
      const isInputFocused = ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)

      // Reset buffer if typing is too slow (manual entry vs scanner burst)
      if (currentTime - lastKeyTime > 100) {
        buffer = ''
      }
      lastKeyTime = currentTime

      if (e.key === 'Enter') {
        // Scanner sends Enter at the end
        if (buffer.length > 3 && !isInputFocused) {
          handleScan(buffer)
          buffer = ''
        }
      } else if (e.key.length === 1) {
        buffer += e.key
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    fetchDashboardData()
  }, [user])

  // Set all groups as collapsed by default in list view when dashboardData is loaded
  useEffect(() => {
    if (dashboardData?.stock && groupingMode === 'grouped' && viewMode === 'list') {
      const categories = [...new Set(dashboardData.stock.map(item => item.category))]
      setCollapsedGroups(new Set(categories))
    }
  }, [dashboardData, groupingMode, viewMode])

  const fetchDashboardData = async () => {
    try {
      const response = await fetch(`/api/dashboard/${user.id}`)
      const data = await response.json()

      if (response.ok) {
        setDashboardData(data)
      } else {
        showError('Failed to load dashboard', data.error)
      }
    } catch (err) {
      showError('Connection Error', 'Failed to connect to server')
    } finally {
      setLoading(false)
    }
  }

  const filteredStock = dashboardData?.stock?.filter(item => {
    const matchesSearch =
      item.drug_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.asset_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.batch_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.category.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesLocation = filterLocation === 'all' || item.location_name === filterLocation
    const matchesStatus = filterStatus === 'all' || item.status_color === filterStatus

    return matchesSearch && matchesLocation && matchesStatus
  }) || []

  // Group medications by category, then by batch+location within each category
  const groupedStock = {}
  const batchGroups = {} // Track batch groups for quantity display

  filteredStock.forEach(item => {
    if (!groupedStock[item.category]) {
      groupedStock[item.category] = []
      batchGroups[item.category] = {}
    }

    // Create unique key for batch+location combination
    const batchLocationKey = `${item.batch_number}-${item.location_id}`

    if (!batchGroups[item.category][batchLocationKey]) {
      // First item of this batch+location combination
      batchGroups[item.category][batchLocationKey] = {
        ...item,
        vialIds: [item.id],  // Track all vial IDs in this group
        quantity: 1
      }
      groupedStock[item.category].push(batchGroups[item.category][batchLocationKey])
    } else {
      // Add to existing batch+location group
      batchGroups[item.category][batchLocationKey].vialIds.push(item.id)
      batchGroups[item.category][batchLocationKey].quantity += 1
    }
  })

  const toggleGroup = (category) => {
    setCollapsedGroups(prev => {
      const newSet = new Set(prev)
      if (newSet.has(category)) {
        newSet.delete(category)
      } else {
        newSet.add(category)
      }
      return newSet
    })
  }

  const locations = [...new Set(dashboardData?.stock?.map(item => item.location_name) || [])]

  // Calculate filtered expiring count based on filterLocation
  const filteredExpiringCount = dashboardData?.stock?.filter(item => {
    const matchesLocation = filterLocation === 'all' || item.location_name === filterLocation
    return matchesLocation && item.days_until_expiry <= 30
  }).length || 0

  const locationText = filterLocation === 'all' ? 'all sites' : filterLocation

  const statsCards = [
    {
      label: 'Total Stock',
      value: dashboardData?.stats?.total_stock || 0,
      icon: Package,
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20'
    },
    {
      label: 'Healthy Stock',
      value: dashboardData?.stats?.healthy_stock || 0,
      icon: CheckCircle,
      color: 'from-emerald-500 to-emerald-600',
      bgColor: 'bg-emerald-50 dark:bg-emerald-900/20'
    },
    {
      label: 'Warning',
      value: dashboardData?.stats?.warning_stock || 0,
      icon: Clock,
      color: 'from-amber-500 to-amber-600',
      bgColor: 'bg-amber-50 dark:bg-amber-900/20'
    },
    {
      label: 'Critical',
      value: dashboardData?.stats?.expiring_soon || 0,
      icon: AlertTriangle,
      color: 'from-red-500 to-red-600',
      bgColor: 'bg-red-50 dark:bg-red-900/20'
    }
  ]

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner" />
      </div>
    )
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
          Medicine Inventory Dashboard
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Real-time view of high-cost medicine inventory across {user.location_name}
        </p>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statsCards.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.1 }}
            className={`relative ${stat.bgColor} rounded-2xl p-6 overflow-hidden group hover:shadow-xl transition-all`}
          >
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <stat.icon className="w-8 h-8 text-gray-700 dark:text-gray-300" />
                <span className={`text-3xl font-bold bg-gradient-to-r ${stat.color} bg-clip-text text-transparent`}>
                  {stat.value}
                </span>
              </div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{stat.label}</p>
            </div>

            {/* Background decoration */}
            <div className={`absolute -right-8 -bottom-8 w-32 h-32 bg-gradient-to-br ${stat.color} 
                          rounded-full opacity-10 group-hover:scale-150 transition-transform`} />
          </motion.div>
        ))}
      </div>

      {/* Filters and Search */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 mb-6"
      >
        <div className="flex flex-wrap gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by drug, asset ID, batch, or category..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none 
                       focus:ring-2 focus:ring-maroon-500 focus:border-transparent bg-white dark:bg-gray-700 dark:text-white"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full transition-colors"
                title="Clear search"
              >
                <XCircle className="w-4 h-4 text-gray-400" />
              </button>
            )}
          </div>

          {/* Location Filter */}
          <select
            value={filterLocation}
            onChange={(e) => setFilterLocation(e.target.value)}
            className="px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl
                     focus:outline-none focus:border-maroon-500 focus:bg-white dark:focus:bg-gray-600 transition-all dark:text-white"
          >
            <option value="all">All Locations</option>
            {locations.map(location => (
              <option key={location} value={location}>{location}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl
                     focus:outline-none focus:border-maroon-500 focus:bg-white dark:focus:bg-gray-600 transition-all dark:text-white"
          >
            <option value="all">All Status</option>
            <option value="green">Healthy (90+ days)</option>
            <option value="amber">Warning (30-90 days)</option>
            <option value="red">Critical (&lt;30 days)</option>
          </select>

          {/* View Toggle */}
          <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
            <button
              onClick={() => setViewMode('grid')}
              title="Card View"
              className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-gray-600 shadow-sm text-maroon-600 dark:text-maroon-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
            >
              <LayoutGrid className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              title="List View"
              className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-white dark:bg-gray-600 shadow-sm text-maroon-600 dark:text-maroon-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
            >
              <List className="w-5 h-5" />
            </button>
          </div>

          {/* Grouping Toggle */}
          <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
            <button
              onClick={() => setGroupingMode('grouped')}
              title="Group by Category"
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all
                       ${groupingMode === 'grouped' ? 'bg-white dark:bg-gray-600 shadow-sm text-maroon-600 dark:text-maroon-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
            >
              Grouped
            </button>
            <button
              onClick={() => setGroupingMode('ungrouped')}
              title="Show All Items"
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all
                       ${groupingMode === 'ungrouped' ? 'bg-white dark:bg-gray-600 shadow-sm text-maroon-600 dark:text-maroon-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
            >
              Show All
            </button>
          </div>

          {/* Scanner Ready Indicator */}
          <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600" title="Scanner is active globally - no need to click search">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Scanner Ready (Anywhere)</span>
          </div>

          {/* QR Scanner Button */}
          <button
            onClick={() => setShowScanner(!showScanner)}
            className="px-6 py-3 bg-gradient-to-r from-maroon-600 to-maroon-700 text-white 
                      font-medium rounded-xl shadow-md hover:shadow-lg transform hover:-translate-y-0.5 
                      transition-all flex items-center gap-2"
          >
            <Scan className="w-5 h-5" />
            Scan QR (Camera)
          </button>
        </div>

        {/* QR Scanner */}
        {showScanner && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            className="mt-4"
          >
            <QRScanner
              onScan={handleScan}
              onClose={() => setShowScanner(false)}
            />
          </motion.div>
        )}
      </motion.div>

      {/* Stock Grid/List */}
      <div className="space-y-4">
        {filteredStock.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12 bg-white dark:bg-gray-800 rounded-2xl">
            <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">No stock items found matching your filters</p>
          </motion.div>
        ) : groupingMode === 'grouped' && viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(groupedStock).sort(([a], [b]) => a.localeCompare(b)).map(([category, items]) => {
              const criticalCount = items.filter(item => item.status_color === 'red').length
              const warningCount = items.filter(item => item.status_color === 'amber').length
              const healthyCount = items.filter(item => item.status_color === 'green').length
              const totalQuantity = items.reduce((sum, item) => sum + (item.quantity || 1), 0)

              return (
                <motion.button
                  key={category}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ scale: 1.02 }}
                  onClick={() => {
                    // Filter to show this category
                    setGroupingMode('ungrouped')
                    setSearchTerm(category)
                  }}
                  className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md 
                           transition-all text-left group cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-maroon-600 dark:group-hover:text-maroon-400 transition-colors">
                        {category}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {totalQuantity} {totalQuantity === 1 ? 'vial' : 'vials'} • {items.length} {items.length === 1 ? 'batch group' : 'batch groups'}
                      </p>
                    </div>
                    <div className="flex-shrink-0">
                      <svg className="w-6 h-6 text-gray-400 group-hover:text-maroon-600 transition-colors"
                        fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {healthyCount > 0 && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 rounded-full">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                        <span className="text-sm font-semibold text-emerald-700">{healthyCount}</span>
                        <span className="text-xs text-emerald-600">Healthy</span>
                      </div>
                    )}
                    {warningCount > 0 && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 rounded-full">
                        <div className="w-2 h-2 bg-amber-500 rounded-full" />
                        <span className="text-sm font-semibold text-amber-700">{warningCount}</span>
                        <span className="text-xs text-amber-600">Warning</span>
                      </div>
                    )}
                    {criticalCount > 0 && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 rounded-full">
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                        <span className="text-sm font-semibold text-red-700">{criticalCount}</span>
                        <span className="text-xs text-red-600">Critical</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Click to view all {category} items
                    </p>
                  </div>
                </motion.button>
              )
            })}
          </div>
        ) : viewMode === 'grid' ? (
          <motion.div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
            {filteredStock.map((item, index) => (
              <motion.div key={item.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.05, 0.5) }}>
                <StockCard item={item} onRefresh={fetchDashboardData} />
              </motion.div>
            ))}
          </motion.div>
        ) : groupingMode === 'grouped' ? (
          // Grouped List View
          <div className="space-y-4">
            {Object.entries(groupedStock).sort(([a], [b]) => a.localeCompare(b)).map(([category, items]) => {
              const isCollapsed = collapsedGroups.has(category)
              const criticalCount = items.filter(item => item.status_color === 'red').length
              const warningCount = items.filter(item => item.status_color === 'amber').length
              const healthyCount = items.filter(item => item.status_color === 'green').length
              const totalVials = items.reduce((sum, item) => sum + (item.quantity || 1), 0)
              const batchGroupsCount = new Set(items.map(item => `${item.batch_number}-${item.location_id}`)).size

              return (
                <div key={category} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <button
                    onClick={() => toggleGroup(category)}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`transform transition-transform ${isCollapsed ? '' : 'rotate-90'}`}>
                        <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                      <div className="text-left">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">{category}</h3>
                        <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400 mt-1">
                          <span>{totalVials} {totalVials === 1 ? 'vial' : 'vials'}</span>
                          <span className="text-gray-300">•</span>
                          <span>{batchGroupsCount} {batchGroupsCount === 1 ? 'batch group' : 'batch groups'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {criticalCount > 0 && (
                        <span className="px-3 py-1 bg-red-100 text-red-700 text-sm font-bold rounded-full flex items-center gap-1.5">
                          {criticalCount > 1 && <span className="text-xs opacity-75">{criticalCount}</span>}
                          <span>Critical</span>
                        </span>
                      )}
                      {warningCount > 0 && (
                        <span className="px-3 py-1 bg-amber-100 text-amber-700 text-sm font-bold rounded-full flex items-center gap-1.5">
                          {warningCount > 1 && <span className="text-xs opacity-75">{warningCount}</span>}
                          <span>Warning</span>
                        </span>
                      )}
                      {healthyCount > 0 && (
                        <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-sm font-bold rounded-full flex items-center gap-1.5">
                          {healthyCount > 1 && <span className="text-xs opacity-75">{healthyCount}</span>}
                          <span>Healthy</span>
                        </span>
                      )}
                    </div>
                  </button>

                  {!isCollapsed && (
                    <div className="border-t border-gray-200 dark:border-gray-700">
                      <table className="w-full text-left">
                        <thead className="bg-gray-50 dark:bg-gray-900/50">
                          <tr>
                            <th className="px-6 py-3 font-semibold text-gray-700 dark:text-gray-300 text-sm">Drug Name</th>
                            <th className="px-6 py-3 font-semibold text-gray-700 dark:text-gray-300 text-sm">Asset ID</th>
                            <th className="px-6 py-3 font-semibold text-gray-700 dark:text-gray-300 text-sm">Batch</th>
                            <th className="px-6 py-3 font-semibold text-gray-700 dark:text-gray-300 text-sm">Location</th>
                            <th className="px-6 py-3 font-semibold text-gray-700 dark:text-gray-300 text-sm">Storage</th>
                            <th className="px-6 py-3 font-semibold text-gray-700 dark:text-gray-300 text-sm">Expiry</th>
                            <th className="px-6 py-3 font-semibold text-gray-700 dark:text-gray-300 text-sm">Status</th>
                            <th className="px-6 py-3 font-semibold text-gray-700 dark:text-gray-300 text-sm text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                          {items.map((item, index) => (
                            <tr key={item.id} className={`hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors
                              ${index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50/50 dark:bg-gray-700/30'}`}>
                              <td className="px-6 py-3">
                                <div className="font-semibold text-gray-900 dark:text-white">{item.drug_name}</div>
                                {item.quantity && item.quantity > 1 && (
                                  <span className="text-xs text-blue-600 dark:text-blue-400 font-bold">×{item.quantity}</span>
                                )}
                              </td>
                              <td className="px-6 py-3 font-mono text-xs text-gray-600 dark:text-gray-400">{item.asset_id}</td>
                              <td className="px-6 py-3 font-mono text-sm text-gray-700 dark:text-gray-300">{item.batch_number}</td>
                              <td className="px-6 py-3 text-sm text-gray-700 dark:text-gray-300">{item.location_name}</td>
                              <td className="px-6 py-3">
                                <div className="flex items-center gap-1.5 text-sm">
                                  {item.storage_temp?.includes('2-8') ? (
                                    <>
                                      <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 8h6m-5 0a3 3 0 110 6H9l3 3m-3-6h6m6 1a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      </svg>
                                      <span className="text-xs text-blue-700 dark:text-blue-300">2-8°C</span>
                                    </>
                                  ) : (
                                    <>
                                      <svg className="w-4 h-4 text-orange-600 dark:text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                      </svg>
                                      <span className="text-xs text-orange-700 dark:text-orange-300">&lt;25°C</span>
                                    </>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-3">
                                <div className="text-sm font-semibold text-gray-900 dark:text-white">{format(new Date(item.expiry_date), 'dd MMM yyyy')}</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">{Math.floor(item.days_until_expiry)} days remaining</div>
                              </td>
                              <td className="px-6 py-3">
                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold
                                  ${item.status_color === 'green' ? 'bg-emerald-100 text-emerald-800' :
                                    item.status_color === 'amber' ? 'bg-amber-100 text-amber-800' :
                                      'bg-red-100 text-red-800'}`}>
                                  {item.status_color === 'green' ? 'Healthy' : item.status_color === 'amber' ? 'Warning' : 'Critical'}
                                </span>
                              </td>
                              <td className="px-6 py-3 text-right">
                                <StockCard item={item} onRefresh={fetchDashboardData} compact={true} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          // Ungrouped List View
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 border-b-2 border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-6 py-4 font-bold text-gray-800 dark:text-gray-200 text-sm">Drug Name</th>
                  <th className="px-6 py-4 font-bold text-gray-800 dark:text-gray-200 text-sm">Asset ID</th>
                  <th className="px-6 py-4 font-bold text-gray-800 dark:text-gray-200 text-sm">Location</th>
                  <th className="px-6 py-4 font-bold text-gray-800 dark:text-gray-200 text-sm">Expiry</th>
                  <th className="px-6 py-4 font-bold text-gray-800 dark:text-gray-200 text-sm">Status</th>
                  <th className="px-6 py-4 font-bold text-gray-800 dark:text-gray-200 text-sm text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filteredStock.map((item, index) => (
                  <tr key={item.id} className={`hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors cursor-pointer
                    ${index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50/50 dark:bg-gray-700/30'}`}>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-900 dark:text-white">{item.drug_name}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{item.category}</div>
                    </td>
                    <td className="px-6 py-4 font-mono text-sm text-gray-700 dark:text-gray-300 font-medium">{item.asset_id}</td>
                    <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">{item.location_name}</td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-semibold text-gray-900 dark:text-white">{format(new Date(item.expiry_date), 'dd MMM yyyy')}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{Math.floor(item.days_until_expiry)} days remaining</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold
                        ${item.status_color === 'green' ? 'bg-emerald-100 text-emerald-800' :
                          item.status_color === 'amber' ? 'bg-amber-100 text-amber-800' :
                            'bg-red-100 text-red-800'}`}>
                        {item.status_color === 'green' ? 'Healthy' : item.status_color === 'amber' ? 'Warning' : 'Critical'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <StockCard item={item} onRefresh={fetchDashboardData} compact={true} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>


    </div>
  )
}

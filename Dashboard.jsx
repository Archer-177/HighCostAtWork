import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  Heart, Pill, AlertTriangle, CheckCircle, Clock, TrendingDown,
  Package, Building2, MapPin, Search, Filter, Scan, AlertCircle
} from 'lucide-react'
import { format } from 'date-fns'
import { useAuth } from '../contexts/AuthContext'
import { useNotification } from '../contexts/NotificationContext'
import StockCard from './StockCard'
import QRScanner from './QRScanner'

export default function Dashboard() {
  const { user } = useAuth()
  const { error: showError } = useNotification()
  const [dashboardData, setDashboardData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterLocation, setFilterLocation] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [showScanner, setShowScanner] = useState(false)

  useEffect(() => {
    fetchDashboardData()
  }, [user])

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
      item.batch_number.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesLocation = filterLocation === 'all' || item.location_name === filterLocation
    const matchesStatus = filterStatus === 'all' || item.status_color === filterStatus
    
    return matchesSearch && matchesLocation && matchesStatus
  }) || []

  const locations = [...new Set(dashboardData?.stock?.map(item => item.location_name) || [])]

  const statsCards = [
    {
      label: 'Total Stock',
      value: dashboardData?.stats?.total_stock || 0,
      icon: Package,
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      label: 'Healthy Stock',
      value: dashboardData?.stats?.healthy_stock || 0,
      icon: CheckCircle,
      color: 'from-emerald-500 to-emerald-600',
      bgColor: 'bg-emerald-50'
    },
    {
      label: 'Warning',
      value: dashboardData?.stats?.warning_stock || 0,
      icon: Clock,
      color: 'from-amber-500 to-amber-600',
      bgColor: 'bg-amber-50'
    },
    {
      label: 'Critical',
      value: dashboardData?.stats?.expiring_soon || 0,
      icon: AlertTriangle,
      color: 'from-red-500 to-red-600',
      bgColor: 'bg-red-50'
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
        <p className="text-gray-600">
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
                <stat.icon className="w-8 h-8 text-gray-700" />
                <span className={`text-3xl font-bold bg-gradient-to-r ${stat.color} bg-clip-text text-transparent`}>
                  {stat.value}
                </span>
              </div>
              <p className="text-sm font-medium text-gray-700">{stat.label}</p>
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
        className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6"
      >
        <div className="flex flex-wrap gap-4">
          {/* Search */}
          <div className="flex-1 min-w-[300px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by drug name, asset ID, or batch..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl
                         focus:outline-none focus:border-maroon-500 focus:bg-white transition-all"
              />
            </div>
          </div>

          {/* Location Filter */}
          <select
            value={filterLocation}
            onChange={(e) => setFilterLocation(e.target.value)}
            className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl
                     focus:outline-none focus:border-maroon-500 focus:bg-white transition-all"
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
            className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl
                     focus:outline-none focus:border-maroon-500 focus:bg-white transition-all"
          >
            <option value="all">All Status</option>
            <option value="green">Healthy (90+ days)</option>
            <option value="amber">Warning (30-90 days)</option>
            <option value="red">Critical (&lt;30 days)</option>
          </select>

          {/* QR Scanner Button */}
          <button
            onClick={() => setShowScanner(!showScanner)}
            className="px-6 py-3 bg-gradient-to-r from-maroon-600 to-maroon-700 text-white 
                     font-medium rounded-xl shadow-md hover:shadow-lg transform hover:-translate-y-0.5 
                     transition-all flex items-center gap-2"
          >
            <Scan className="w-5 h-5" />
            Scan QR
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
              onScan={(assetId) => {
                setSearchTerm(assetId)
                setShowScanner(false)
              }}
              onClose={() => setShowScanner(false)}
            />
          </motion.div>
        )}
      </motion.div>

      {/* Stock Grid */}
      <div className="space-y-4">
        {filteredStock.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12 bg-white rounded-2xl"
          >
            <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No stock items found matching your filters</p>
          </motion.div>
        ) : (
          <motion.div 
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            {filteredStock.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.05, 0.5) }}
              >
                <StockCard
                  item={item}
                  onRefresh={fetchDashboardData}
                />
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      {/* Low Stock Alert */}
      {dashboardData?.stats?.expiring_soon > 5 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="fixed bottom-6 right-6 bg-red-900 text-white p-4 rounded-lg shadow-2xl 
                   max-w-sm animate-alert-pulse"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 flex-shrink-0" />
            <div>
              <p className="font-semibold">Critical Stock Alert</p>
              <p className="text-sm mt-1 opacity-90">
                {dashboardData.stats.expiring_soon} items expiring within 30 days. 
                Consider stock rotation immediately.
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}

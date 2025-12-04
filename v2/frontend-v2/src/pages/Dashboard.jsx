import { useEffect, useState } from 'react'
import { Package, CheckCircle, Clock, AlertTriangle, TrendingUp, MoreVertical, Syringe, Trash2 } from 'lucide-react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import useAuthStore from '../store/authStore'
import { stockAPI } from '../api/stock'
import StockUseModal from '../components/StockUseModal'
import StockDiscardModal from '../components/StockDiscardModal'

export default function Dashboard() {
  const { user } = useAuthStore()
  const [dashboardData, setDashboardData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedVial, setSelectedVial] = useState(null)
  const [showUseModal, setShowUseModal] = useState(false)
  const [showDiscardModal, setShowDiscardModal] = useState(false)
  const [openMenuId, setOpenMenuId] = useState(null)

  useEffect(() => {
    fetchDashboardData()
  }, [user])

  const fetchDashboardData = async () => {
    try {
      const data = await stockAPI.getDashboard(user.id)
      setDashboardData(data)
    } catch (error) {
      toast.error('Failed to load dashboard')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleUseStock = (vial) => {
    setSelectedVial(vial)
    setShowUseModal(true)
    setOpenMenuId(null)
  }

  const handleDiscardStock = (vial) => {
    setSelectedVial(vial)
    setShowDiscardModal(true)
    setOpenMenuId(null)
  }

  const handleModalSuccess = () => {
    fetchDashboardData()
  }

  const toggleMenu = (vialId) => {
    setOpenMenuId(openMenuId === vialId ? null : vialId)
  }

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null)
    if (openMenuId) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [openMenuId])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="spinner" />
      </div>
    )
  }

  const statsCards = [
    {
      label: 'Total Stock',
      value: dashboardData?.stats?.total_stock || 0,
      icon: Package,
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    },
    {
      label: 'Healthy',
      value: dashboardData?.stats?.healthy_stock || 0,
      icon: CheckCircle,
      color: 'from-emerald-500 to-emerald-600',
      bgColor: 'bg-emerald-50 dark:bg-emerald-900/20',
    },
    {
      label: 'Warning',
      value: dashboardData?.stats?.warning_stock || 0,
      icon: Clock,
      color: 'from-amber-500 to-amber-600',
      bgColor: 'bg-amber-50 dark:bg-amber-900/20',
    },
    {
      label: 'Critical',
      value: dashboardData?.stats?.expiring_soon || 0,
      icon: AlertTriangle,
      color: 'from-red-500 to-red-600',
      bgColor: 'bg-red-50 dark:bg-red-900/20',
    },
  ]

  return (
    <div>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-4xl font-display font-bold gradient-text mb-2">
          Dashboard
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Welcome back, {user?.username}!
        </p>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statsCards.map((stat, index) => {
          const Icon = stat.icon
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="card hover:shadow-lg transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                    {stat.label}
                  </p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                    {stat.value}
                  </p>
                </div>
                <div className={`p-3 rounded-xl ${stat.bgColor}`}>
                  <Icon className="w-6 h-6 text-gray-700 dark:text-gray-300" />
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Stock Value Card */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="card mb-8"
      >
        <div className="flex items-center gap-4">
          <div className="p-4 rounded-xl bg-gradient-to-br from-maroon-500 to-ochre-500">
            <TrendingUp className="w-8 h-8 text-white" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
              Total Stock Value
            </p>
            <p className="text-4xl font-bold gradient-text">
              ${(dashboardData?.stats?.total_value || 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Stock List with Actions */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="card"
      >
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Recent Stock
        </h2>
        {dashboardData?.stock && dashboardData.stock.length > 0 ? (
          <div className="space-y-2">
            {dashboardData.stock.slice(0, 10).map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="flex-1">
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    {item.drug_name}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {item.asset_id} • {item.location_name}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`badge badge-${item.status_color}`}>
                    {item.days_until_expiry} days
                  </span>

                  {/* Actions Menu */}
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleMenu(item.id)
                      }}
                      className="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {/* Dropdown Menu */}
                    {openMenuId === item.id && (
                      <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10">
                        <button
                          onClick={() => handleUseStock(item)}
                          className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-t-lg transition-colors"
                        >
                          <Syringe className="w-4 h-4 text-green-600 dark:text-green-400" />
                          Use Stock
                        </button>
                        <button
                          onClick={() => handleDiscardStock(item)}
                          className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-b-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                          Discard Stock
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-500 dark:text-gray-400 py-8">
            No stock available
          </p>
        )}
      </motion.div>

      {/* Modals */}
      {showUseModal && selectedVial && (
        <StockUseModal
          vial={selectedVial}
          onClose={() => setShowUseModal(false)}
          onSuccess={handleModalSuccess}
        />
      )}

      {showDiscardModal && selectedVial && (
        <StockDiscardModal
          vial={selectedVial}
          onClose={() => setShowDiscardModal(false)}
          onSuccess={handleModalSuccess}
        />
      )}
    </div>
  )
}

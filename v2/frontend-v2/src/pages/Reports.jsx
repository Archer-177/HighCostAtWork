import { useState, useEffect } from 'react'
import {
  BarChart3,
  TrendingUp,
  AlertTriangle,
  Package,
  Trash2,
  ArrowRightLeft,
  Download,
  Calendar,
  DollarSign
} from 'lucide-react'
import { stockAPI } from '../api/stock'
import { transfersAPI } from '../api/transfers'
import { adminAPI } from '../api/admin'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'

export default function Reports() {
  const user = useAuthStore((state) => state.user)
  const [activeTab, setActiveTab] = useState('overview') // overview, expiry, usage, wastage, transfers
  const [loading, setLoading] = useState(true)
  const [reportData, setReportData] = useState(null)
  const [dateRange, setDateRange] = useState('30') // 7, 30, 90 days

  useEffect(() => {
    loadReportData()
  }, [activeTab, dateRange])

  const loadReportData = async () => {
    setLoading(true)
    try {
      // In a real implementation, we'd have dedicated report endpoints
      // For now, we'll simulate with available data
      const data = await stockAPI.getDashboard(user.id)
      setReportData(data)
    } catch (error) {
      toast.error('Failed to load report data')
    } finally {
      setLoading(false)
    }
  }

  const handleExport = () => {
    toast.success('Export functionality coming soon!', { duration: 3000 })
    // TODO: Implement CSV/PDF export
  }

  const tabs = [
    { id: 'overview', label: 'Stock Overview', icon: Package },
    { id: 'expiry', label: 'Expiry Report', icon: AlertTriangle },
    { id: 'usage', label: 'Usage Statistics', icon: TrendingUp },
    { id: 'wastage', label: 'Wastage Report', icon: Trash2 },
    { id: 'transfers', label: 'Transfer Activity', icon: ArrowRightLeft }
  ]

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-4xl font-display font-bold gradient-text mb-2">
            Reports & Analytics
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Comprehensive insights into your medicine inventory
          </p>
        </div>
        <button
          onClick={handleExport}
          className="btn-secondary flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          Export
        </button>
      </div>

      {/* Date Range Filter */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setDateRange('7')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            dateRange === '7'
              ? 'bg-maroon text-white dark:bg-ochre'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
          }`}
        >
          Last 7 Days
        </button>
        <button
          onClick={() => setDateRange('30')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            dateRange === '30'
              ? 'bg-maroon text-white dark:bg-ochre'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
          }`}
        >
          Last 30 Days
        </button>
        <button
          onClick={() => setDateRange('90')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            dateRange === '90'
              ? 'bg-maroon text-white dark:bg-ochre'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
          }`}
        >
          Last 90 Days
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto border-b border-gray-200 dark:border-gray-700">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 font-semibold transition-colors relative whitespace-nowrap flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'text-maroon dark:text-ochre'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-maroon dark:bg-ochre" />
              )}
            </button>
          )
        })}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-maroon"></div>
        </div>
      ) : (
        <>
          {activeTab === 'overview' && <StockOverview data={reportData} />}
          {activeTab === 'expiry' && <ExpiryReport data={reportData} />}
          {activeTab === 'usage' && <UsageStatistics data={reportData} dateRange={dateRange} />}
          {activeTab === 'wastage' && <WastageReport data={reportData} dateRange={dateRange} />}
          {activeTab === 'transfers' && <TransferActivity data={reportData} dateRange={dateRange} />}
        </>
      )}
    </div>
  )
}

// ============================================================================
// STOCK OVERVIEW COMPONENT
// ============================================================================
function StockOverview({ data }) {
  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
              Total Stock
            </span>
            <Package className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-3xl font-bold text-blue-900 dark:text-blue-100">
            {data?.stats?.total_stock || 0}
          </div>
          <div className="text-xs text-blue-700 dark:text-blue-300 mt-1">
            Across all locations
          </div>
        </div>

        <div className="card bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-green-900 dark:text-green-100">
              Healthy Stock
            </span>
            <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <div className="text-3xl font-bold text-green-900 dark:text-green-100">
            {data?.stats?.healthy_stock || 0}
          </div>
          <div className="text-xs text-green-700 dark:text-green-300 mt-1">
            90+ days to expiry
          </div>
        </div>

        <div className="card bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-amber-900 dark:text-amber-100">
              Warning
            </span>
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="text-3xl font-bold text-amber-900 dark:text-amber-100">
            {data?.stats?.warning_stock || 0}
          </div>
          <div className="text-xs text-amber-700 dark:text-amber-300 mt-1">
            30-90 days to expiry
          </div>
        </div>

        <div className="card bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-red-900 dark:text-red-100">
              Critical
            </span>
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
          </div>
          <div className="text-3xl font-bold text-red-900 dark:text-red-100">
            {data?.stats?.expiring_soon || 0}
          </div>
          <div className="text-xs text-red-700 dark:text-red-300 mt-1">
            &lt;30 days to expiry
          </div>
        </div>
      </div>

      {/* Stock Value */}
      <div className="card">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-gradient-to-br from-maroon to-ochre rounded-xl">
            <DollarSign className="w-8 h-8 text-white" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
              Total Stock Value
            </p>
            <p className="text-4xl font-bold gradient-text">
              ${(data?.stats?.total_value || 0).toLocaleString('en-AU', {
                minimumFractionDigits: 2
              })}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              At {data?.user_location || 'current location'}
            </p>
          </div>
        </div>
      </div>

      {/* Stock by Drug */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">Stock Levels by Drug</h3>
        {data?.stock && data.stock.length > 0 ? (
          <div className="space-y-3">
            {/* Group by drug and count */}
            {Object.entries(
              data.stock.reduce((acc, item) => {
                acc[item.drug_name] = (acc[item.drug_name] || 0) + 1
                return acc
              }, {})
            )
              .sort((a, b) => b[1] - a[1])
              .slice(0, 10)
              .map(([drugName, count]) => (
                <div
                  key={drugName}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                >
                  <span className="font-medium">{drugName}</span>
                  <div className="flex items-center gap-4">
                    <div className="w-48 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-maroon to-ochre h-2 rounded-full"
                        style={{
                          width: `${Math.min((count / (data?.stats?.total_stock || 1)) * 100, 100)}%`
                        }}
                      />
                    </div>
                    <span className="font-bold text-maroon dark:text-ochre w-12 text-right">
                      {count}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        ) : (
          <p className="text-center text-gray-500 dark:text-gray-400 py-8">
            No stock data available
          </p>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// EXPIRY REPORT COMPONENT
// ============================================================================
function ExpiryReport({ data }) {
  const criticalStock = data?.stock?.filter((item) => item.status_color === 'red') || []
  const warningStock = data?.stock?.filter((item) => item.status_color === 'amber') || []

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-red-100 dark:bg-red-900/40 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-red-900 dark:text-red-100">
                {criticalStock.length}
              </div>
              <div className="text-sm text-red-700 dark:text-red-300">
                Critical (&lt;30 days)
              </div>
            </div>
          </div>
        </div>

        <div className="card bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/40 rounded-lg">
              <Calendar className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-amber-900 dark:text-amber-100">
                {warningStock.length}
              </div>
              <div className="text-sm text-amber-700 dark:text-amber-300">
                Warning (30-90 days)
              </div>
            </div>
          </div>
        </div>

        <div className="card bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-lg">
              <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                {((criticalStock.length + warningStock.length) / (data?.stats?.total_stock || 1) * 100).toFixed(1)}%
              </div>
              <div className="text-sm text-blue-700 dark:text-blue-300">
                Requires Attention
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Critical Items */}
      {criticalStock.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Critical - Expires in &lt;30 Days
          </h3>
          <div className="space-y-2">
            {criticalStock.map((item) => (
              <div
                key={item.id}
                className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="font-mono text-sm font-bold text-red-700 dark:text-red-300 mb-1">
                      {item.asset_id}
                    </div>
                    <div className="font-medium text-gray-900 dark:text-gray-100">
                      {item.drug_name}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Batch: {item.batch_number} • Expires:{' '}
                      {new Date(item.expiry_date).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                      {item.days_until_expiry}
                    </div>
                    <div className="text-sm text-red-700 dark:text-red-300">
                      days left
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Warning Items */}
      {warningStock.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold text-amber-900 dark:text-amber-100 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Warning - Expires in 30-90 Days
          </h3>
          <div className="space-y-2">
            {warningStock.slice(0, 5).map((item) => (
              <div
                key={item.id}
                className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="font-mono text-sm font-bold text-amber-700 dark:text-amber-300 mb-1">
                      {item.asset_id}
                    </div>
                    <div className="font-medium text-gray-900 dark:text-gray-100">
                      {item.drug_name}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Expires: {new Date(item.expiry_date).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-amber-600 dark:text-amber-400">
                      {item.days_until_expiry}
                    </div>
                    <div className="text-sm text-amber-700 dark:text-amber-300">
                      days left
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {warningStock.length > 5 && (
              <p className="text-center text-sm text-gray-600 dark:text-gray-400 pt-2">
                And {warningStock.length - 5} more items...
              </p>
            )}
          </div>
        </div>
      )}

      {criticalStock.length === 0 && warningStock.length === 0 && (
        <div className="card text-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="p-4 bg-green-100 dark:bg-green-900/40 rounded-full">
              <TrendingUp className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                All Clear!
              </p>
              <p className="text-gray-600 dark:text-gray-400">
                No stock expiring in the next 90 days
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// USAGE STATISTICS COMPONENT
// ============================================================================
function UsageStatistics({ data, dateRange }) {
  return (
    <div className="card">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-blue-100 dark:bg-blue-900/40 rounded-lg">
          <BarChart3 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Usage Statistics</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Last {dateRange} days
          </p>
        </div>
      </div>

      <div className="text-center py-12">
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Usage tracking will be available once stock use data is recorded
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-500">
          Use the "Use Stock" action on the dashboard to track clinical usage
        </p>
      </div>
    </div>
  )
}

// ============================================================================
// WASTAGE REPORT COMPONENT
// ============================================================================
function WastageReport({ data, dateRange }) {
  return (
    <div className="card">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-red-100 dark:bg-red-900/40 rounded-lg">
          <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Wastage Report</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Last {dateRange} days
          </p>
        </div>
      </div>

      <div className="text-center py-12">
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Wastage tracking will be available once discard data is recorded
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-500">
          Use the "Discard Stock" action on the dashboard to track wastage
        </p>
      </div>
    </div>
  )
}

// ============================================================================
// TRANSFER ACTIVITY COMPONENT
// ============================================================================
function TransferActivity({ data, dateRange }) {
  return (
    <div className="card">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-purple-100 dark:bg-purple-900/40 rounded-lg">
          <ArrowRightLeft className="w-6 h-6 text-purple-600 dark:text-purple-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Transfer Activity</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Last {dateRange} days
          </p>
        </div>
      </div>

      <div className="text-center py-12">
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Transfer analytics will be available once transfer data is recorded
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-500">
          Visit the Stock Transfers page to create and manage transfers
        </p>
      </div>
    </div>
  )
}

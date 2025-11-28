import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  FileText, Download, Calendar, TrendingUp, TrendingDown, 
  DollarSign, Package, AlertTriangle, PieChart, BarChart3,
  FileDown, Filter
} from 'lucide-react'
import { format, subDays } from 'date-fns'
import { BarChart, Bar, LineChart, Line, PieChart as RePieChart, Pie, Cell, 
         XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { useAuth } from '../contexts/AuthContext'
import { useNotification } from '../contexts/NotificationContext'

export default function Reports() {
  const { user } = useAuth()
  const { error: showError, success } = useNotification()
  
  const [dateRange, setDateRange] = useState({
    start: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  })
  const [reportData, setReportData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeReport, setActiveReport] = useState('overview')

  useEffect(() => {
    fetchReportData()
  }, [dateRange])

  const fetchReportData = async () => {
    setLoading(true)
    try {
      const response = await fetch(
        `/api/reports/usage?start_date=${dateRange.start}&end_date=${dateRange.end}`
      )
      const data = await response.json()
      
      if (response.ok) {
        setReportData(data)
      } else {
        showError('Failed to load report data')
      }
    } catch (err) {
      showError('Connection Error', 'Failed to fetch reports')
    } finally {
      setLoading(false)
    }
  }

  const generatePDF = async () => {
    success('Generating PDF', 'Your report is being prepared...')
    // In a real implementation, this would call a PDF generation endpoint
    setTimeout(() => {
      success('PDF Ready', 'Your report has been downloaded')
    }, 2000)
  }

  // Calculate summary statistics
  const calculateStats = () => {
    if (!reportData?.data) return {
      totalClinicalValue: 0,
      totalWastageValue: 0,
      totalClinicalUse: 0,
      totalWastage: 0,
      wastageRate: 0
    }

    const stats = reportData.data.reduce((acc, item) => ({
      totalClinicalValue: acc.totalClinicalValue + (item.clinical_value || 0),
      totalWastageValue: acc.totalWastageValue + (item.wastage_value || 0),
      totalClinicalUse: acc.totalClinicalUse + (item.clinical_use || 0),
      totalWastage: acc.totalWastage + (item.wastage || 0)
    }), {
      totalClinicalValue: 0,
      totalWastageValue: 0,
      totalClinicalUse: 0,
      totalWastage: 0
    })

    stats.wastageRate = stats.totalClinicalUse + stats.totalWastage > 0 
      ? (stats.totalWastage / (stats.totalClinicalUse + stats.totalWastage) * 100).toFixed(1)
      : 0

    return stats
  }

  const stats = calculateStats()

  // Prepare chart data
  const prepareChartData = () => {
    if (!reportData?.data) return { barData: [], pieData: [] }

    // Bar chart data - by location
    const locationData = reportData.data.reduce((acc, item) => {
      const existing = acc.find(loc => loc.location === item.location_name)
      if (existing) {
        existing.clinical += item.clinical_value || 0
        existing.wastage += item.wastage_value || 0
      } else {
        acc.push({
          location: item.location_name,
          clinical: item.clinical_value || 0,
          wastage: item.wastage_value || 0
        })
      }
      return acc
    }, [])

    // Pie chart data - by drug
    const drugData = reportData.data.reduce((acc, item) => {
      const existing = acc.find(drug => drug.name === item.drug_name)
      if (existing) {
        existing.value += (item.clinical_value || 0) + (item.wastage_value || 0)
      } else {
        acc.push({
          name: item.drug_name,
          value: (item.clinical_value || 0) + (item.wastage_value || 0)
        })
      }
      return acc
    }, [])

    return { barData: locationData, pieData: drugData }
  }

  const { barData, pieData } = prepareChartData()

  const COLORS = ['#8A2A2B', '#D97B5A', '#f97316', '#16a34a', '#3b82f6']

  const reportCards = [
    {
      label: 'Clinical Usage',
      value: `$${stats.totalClinicalValue.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`,
      count: `${stats.totalClinicalUse} items`,
      icon: TrendingUp,
      color: 'from-emerald-500 to-emerald-600',
      bgColor: 'bg-emerald-50'
    },
    {
      label: 'Total Wastage',
      value: `$${stats.totalWastageValue.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`,
      count: `${stats.totalWastage} items`,
      icon: TrendingDown,
      color: 'from-red-500 to-red-600',
      bgColor: 'bg-red-50'
    },
    {
      label: 'Wastage Rate',
      value: `${stats.wastageRate}%`,
      count: 'of total usage',
      icon: PieChart,
      color: 'from-amber-500 to-amber-600',
      bgColor: 'bg-amber-50'
    },
    {
      label: 'Total Value',
      value: `$${(stats.totalClinicalValue + stats.totalWastageValue).toLocaleString('en-AU', { minimumFractionDigits: 2 })}`,
      count: 'tracked inventory',
      icon: DollarSign,
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-50'
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-display tracking-wider gradient-text mb-2">
              Financial Reports
            </h1>
            <p className="text-gray-600">
              Medicine usage and wastage analytics
            </p>
          </div>
          
          <button
            onClick={generatePDF}
            className="px-6 py-3 bg-gradient-to-r from-gray-700 to-gray-900 text-white 
                     font-medium rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 
                     transition-all flex items-center gap-2"
          >
            <FileDown className="w-5 h-5" />
            Export PDF
          </button>
        </div>
      </motion.div>

      {/* Date Range Filter */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6"
      >
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">Date Range:</span>
          </div>
          
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
            className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg
                     focus:outline-none focus:border-maroon-500 focus:bg-white transition-all"
          />
          
          <span className="text-gray-400">to</span>
          
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
            className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg
                     focus:outline-none focus:border-maroon-500 focus:bg-white transition-all"
          />
          
          <div className="ml-auto flex gap-2">
            <button
              onClick={() => setDateRange({
                start: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
                end: format(new Date(), 'yyyy-MM-dd')
              })}
              className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Last 7 days
            </button>
            <button
              onClick={() => setDateRange({
                start: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
                end: format(new Date(), 'yyyy-MM-dd')
              })}
              className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Last 30 days
            </button>
            <button
              onClick={() => setDateRange({
                start: format(subDays(new Date(), 90), 'yyyy-MM-dd'),
                end: format(new Date(), 'yyyy-MM-dd')
              })}
              className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Last 90 days
            </button>
          </div>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {reportCards.map((stat, index) => (
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
                <span className={`text-2xl font-bold bg-gradient-to-r ${stat.color} bg-clip-text text-transparent`}>
                  {stat.value}
                </span>
              </div>
              <p className="text-sm font-medium text-gray-700">{stat.label}</p>
              <p className="text-xs text-gray-600 mt-1">{stat.count}</p>
            </div>
            
            <div className={`absolute -right-8 -bottom-8 w-32 h-32 bg-gradient-to-br ${stat.color} 
                          rounded-full opacity-10 group-hover:scale-150 transition-transform`} />
          </motion.div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Location Performance */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
        >
          <h3 className="text-xl font-bold mb-6 flex items-center gap-3">
            <BarChart3 className="w-6 h-6 text-maroon-600" />
            Value by Location
          </h3>
          
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis 
                dataKey="location" 
                angle={-45} 
                textAnchor="end" 
                height={80}
                tick={{ fontSize: 12 }}
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => `$${(value / 1000).toFixed(1)}k`}
              />
              <Tooltip 
                formatter={(value) => `$${value.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`}
              />
              <Legend />
              <Bar dataKey="clinical" fill="#16a34a" name="Clinical Use" radius={[4, 4, 0, 0]} />
              <Bar dataKey="wastage" fill="#dc2626" name="Wastage" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Drug Distribution */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
        >
          <h3 className="text-xl font-bold mb-6 flex items-center gap-3">
            <PieChart className="w-6 h-6 text-maroon-600" />
            Value by Medicine
          </h3>
          
          <ResponsiveContainer width="100%" height={300}>
            <RePieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value) => `$${value.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`}
              />
            </RePieChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Detailed Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mt-6 bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
      >
        <h3 className="text-xl font-bold mb-6">Detailed Breakdown</h3>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Location</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Medicine</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700">Clinical Use</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700">Clinical Value</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700">Wastage</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700">Wastage Value</th>
              </tr>
            </thead>
            <tbody>
              {reportData?.data?.map((row, index) => (
                <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4">{row.location_name}</td>
                  <td className="py-3 px-4">{row.drug_name}</td>
                  <td className="text-right py-3 px-4">{row.clinical_use}</td>
                  <td className="text-right py-3 px-4 text-emerald-600 font-medium">
                    ${row.clinical_value.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="text-right py-3 px-4">{row.wastage}</td>
                  <td className="text-right py-3 px-4 text-red-600 font-medium">
                    ${row.wastage_value.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-300 font-semibold">
                <td colSpan="2" className="py-3 px-4">Total</td>
                <td className="text-right py-3 px-4">{stats.totalClinicalUse}</td>
                <td className="text-right py-3 px-4 text-emerald-600">
                  ${stats.totalClinicalValue.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                </td>
                <td className="text-right py-3 px-4">{stats.totalWastage}</td>
                <td className="text-right py-3 px-4 text-red-600">
                  ${stats.totalWastageValue.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </motion.div>
    </div>
  )
}

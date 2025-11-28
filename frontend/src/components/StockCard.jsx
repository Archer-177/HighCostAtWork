import React, { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Pill, Calendar, MapPin, Thermometer, Hash, Package,
  CheckCircle, XCircle, AlertTriangle, MoreVertical, QrCode
} from 'lucide-react'
import { format, differenceInDays } from 'date-fns'
import { useAuth } from '../contexts/AuthContext'
import { useNotification } from '../contexts/NotificationContext'

export default function StockCard({ item, onRefresh, compact = false }) {
  const { user } = useAuth()
  const { success, error: showError } = useNotification()
  const [showActions, setShowActions] = useState(false)
  const [showDiscardModal, setShowDiscardModal] = useState(false)
  const [discardReason, setDiscardReason] = useState('')
  const [loading, setLoading] = useState(false)

  const daysUntilExpiry = Math.floor(item.days_until_expiry)

  const statusConfig = {
    green: {
      bg: 'medicine-card-healthy',
      icon: CheckCircle,
      iconColor: 'text-emerald-600',
      label: 'Healthy',
      labelColor: 'text-emerald-700'
    },
    amber: {
      bg: 'medicine-card-warning',
      icon: AlertTriangle,
      iconColor: 'text-amber-600',
      label: 'Warning',
      labelColor: 'text-amber-700'
    },
    red: {
      bg: 'medicine-card-critical',
      icon: AlertTriangle,
      iconColor: 'text-red-600',
      label: 'Critical',
      labelColor: 'text-red-700'
    }
  }

  const config = statusConfig[item.status_color]
  const StatusIcon = config.icon

  const handleUse = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/use_stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vial_id: item.id,
          user_id: user.id,
          action: 'USE',
          version: item.version // Send version
        })
      })

      const data = await response.json()

      if (response.ok) {
        success('Stock Used', `${item.drug_name} marked as used`)
        if (data.needs_notification) {
          // In a real app, this might trigger a local alert too
          console.log('Low stock alert triggered')
        }
        onRefresh?.()
      } else if (response.status === 409) {
        showError('Update Conflict', 'Data has changed. Refreshing...')
        onRefresh?.()
      } else {
        showError('Error', data.error)
      }
    } catch (err) {
      showError('Connection Error', 'Failed to update stock status')
    } finally {
      setLoading(false)
      setShowActions(false)
    }
  }

  const handleDiscard = async () => {
    if (!discardReason) {
      showError('Reason Required', 'Please select a discard reason')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/use_stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vial_id: item.id,
          user_id: user.id,
          action: 'DISCARD',
          discard_reason: discardReason,
          version: item.version // Send version
        })
      })

      const data = await response.json()

      if (response.ok) {
        success('Stock Discarded', `${item.drug_name} marked as discarded`)
        setShowDiscardModal(false)
        setDiscardReason('')
        onRefresh?.()
      } else if (response.status === 409) {
        showError('Update Conflict', 'Data has changed. Refreshing...')
        setShowDiscardModal(false)
        onRefresh?.()
      } else {
        showError('Error', data.error)
      }
    } catch (err) {
      showError('Connection Error', 'Failed to update stock status')
    } finally {
      setLoading(false)
      setShowActions(false)
      setShowDiscardModal(false)
      setDiscardReason('')
    }
  }

  const storageIcon = item.storage_temp?.includes('2-8') ?
    { icon: Thermometer, label: 'Fridge (2-8°C)', color: 'text-blue-600' } :
    { icon: Package, label: 'Shelf (<25°C)', color: 'text-orange-600' }

  if (compact) {
    return (
      <>
        <div className="relative">
          <button
            onClick={() => setShowActions(!showActions)}
            disabled={loading}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <MoreVertical className="w-5 h-5 text-gray-500" />
          </button>

          {showActions && !loading && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-xl 
                            border border-gray-200 overflow-hidden z-50"
            >
              <button
                onClick={handleUse}
                className="w-full px-4 py-3 text-left hover:bg-emerald-50 transition-colors
                            flex items-center gap-3 text-emerald-700"
              >
                <CheckCircle className="w-4 h-4" />
                <span className="font-medium text-sm">Use (Clinical)</span>
              </button>

              <button
                onClick={() => setShowDiscardModal(true)}
                className="w-full px-4 py-3 text-left hover:bg-red-50 transition-colors
                            flex items-center gap-3 text-red-700 border-t"
              >
                <XCircle className="w-4 h-4" />
                <span className="font-medium text-sm">Discard</span>
              </button>
            </motion.div>
          )}
        </div>
        {/* Reuse modal logic */}
        {showDiscardModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowDiscardModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold mb-4">Discard Medicine</h3>

              <p className="text-gray-600 mb-4">
                Please select the reason for discarding <strong>{item.drug_name}</strong>
                (Asset: {item.asset_id})
              </p>

              <div className="space-y-2 mb-6">
                {['Expired', 'Broken/Damaged', 'Fridge Failure', 'Lost'].map(reason => (
                  <label key={reason} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="radio"
                      name="discardReason"
                      value={reason}
                      checked={discardReason === reason}
                      onChange={(e) => setDiscardReason(e.target.value)}
                      className="w-4 h-4 text-maroon-600"
                    />
                    <span className="font-medium">{reason}</span>
                  </label>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowDiscardModal(false)}
                  className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 
                                font-medium rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDiscard}
                  disabled={!discardReason || loading}
                  className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white 
                                font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {loading ? 'Processing...' : 'Confirm Discard'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </>
    )
  }

  return (
    <>
      <motion.div
        whileHover={{ y: -4, shadow: 'lg' }}
        className={`relative ${config.bg} rounded-xl p-4 border shadow-sm transition-all group overflow-hidden`}
      >
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute -right-8 -top-8 w-32 h-32">
            <Pill className="w-full h-full transform rotate-12" />
          </div>
        </div>

        {/* Content */}
        <div className="relative z-10">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900">{item.drug_name}</h3>
              <p className="text-sm text-gray-600">{item.category}</p>
            </div>
            <div className="flex items-center gap-2">
              <StatusIcon className={`w-5 h-5 ${config.iconColor}`} />
              <span className={`text-sm font-semibold ${config.labelColor}`}>
                {config.label}
              </span>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="flex items-center gap-2 text-sm">
              <QrCode className="w-4 h-4 text-gray-400" />
              <span className="font-mono font-semibold">{item.asset_id}</span>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <Hash className="w-4 h-4 text-gray-400" />
              <span>{item.batch_number}</span>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <MapPin className="w-4 h-4 text-gray-400" />
              <span className="truncate">{item.location_name}</span>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <storageIcon.icon className={`w-4 h-4 ${storageIcon.color}`} />
              <span>{storageIcon.label}</span>
            </div>
          </div>

          {/* Expiry Info */}
          <div className="bg-white/50 rounded-xl p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Expires</span>
              <span className="font-semibold">{format(new Date(item.expiry_date), 'dd MMM yyyy')}</span>
            </div>

            <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
              <motion.div
                className={`absolute left-0 top-0 h-full rounded-full ${daysUntilExpiry > 90 ? 'bg-emerald-500' :
                  daysUntilExpiry > 30 ? 'bg-amber-500' : 'bg-red-500'
                  }`}
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(0, Math.min(100, (daysUntilExpiry / 365) * 100))}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
              />
            </div>

            <p className="text-center mt-2 font-semibold">
              {daysUntilExpiry > 0 ? (
                <span>{daysUntilExpiry} days remaining</span>
              ) : (
                <span className="text-red-600">Expired {Math.abs(daysUntilExpiry)} days ago</span>
              )}
            </p>
          </div>

          {/* Price Tag */}
          <div className="mt-4 flex items-center justify-between">
            <span className="text-sm text-gray-600">Unit Value</span>
            <span className="text-lg font-bold gradient-text">
              ${item.unit_price?.toFixed(2)}
            </span>
          </div>

          {/* Action Button */}
          <div className="mt-4 relative">
            <button
              onClick={() => setShowActions(!showActions)}
              disabled={loading}
              className="w-full py-2 bg-white/70 hover:bg-white text-gray-700 font-medium 
                       rounded-lg transition-all flex items-center justify-center gap-2
                       disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <MoreVertical className="w-4 h-4" />
              Actions
            </button>

            {/* Action Menu */}
            {showActions && !loading && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-lg shadow-xl 
                         border border-gray-200 overflow-hidden z-20"
              >
                <button
                  onClick={handleUse}
                  className="w-full px-4 py-3 text-left hover:bg-emerald-50 transition-colors
                           flex items-center gap-3 text-emerald-700"
                >
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">Use (Clinical)</span>
                </button>

                <button
                  onClick={() => setShowDiscardModal(true)}
                  className="w-full px-4 py-3 text-left hover:bg-red-50 transition-colors
                           flex items-center gap-3 text-red-700 border-t"
                >
                  <XCircle className="w-5 h-5" />
                  <span className="font-medium">Discard</span>
                </button>
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Discard Modal */}
      {showDiscardModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowDiscardModal(false)}
        >
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold mb-4">Discard Medicine</h3>

            <p className="text-gray-600 mb-4">
              Please select the reason for discarding <strong>{item.drug_name}</strong>
              (Asset: {item.asset_id})
            </p>

            <div className="space-y-2 mb-6">
              {['Expired', 'Broken/Damaged', 'Fridge Failure', 'Lost'].map(reason => (
                <label key={reason} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input
                    type="radio"
                    name="discardReason"
                    value={reason}
                    checked={discardReason === reason}
                    onChange={(e) => setDiscardReason(e.target.value)}
                    className="w-4 h-4 text-maroon-600"
                  />
                  <span className="font-medium">{reason}</span>
                </label>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDiscardModal(false)}
                className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 
                         font-medium rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDiscard}
                disabled={!discardReason || loading}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white 
                         font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {loading ? 'Processing...' : 'Confirm Discard'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </>
  )
}

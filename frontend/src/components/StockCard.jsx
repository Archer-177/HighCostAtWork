import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  Pill, Calendar, MapPin, Thermometer, Hash, Package,
  CheckCircle, XCircle, AlertTriangle, MoreVertical, QrCode, TruckIcon
} from 'lucide-react'
import { format, differenceInDays } from 'date-fns'
import { useAuth } from '../contexts/AuthContext'
import { useNotification } from '../contexts/NotificationContext'
import { useNavigate } from 'react-router-dom'

export default function StockCard({ item, onRefresh, compact = false, hideActions = false }) {
  const { user } = useAuth()
  const { success, error: showError } = useNotification()
  const navigate = useNavigate()
  const [showActions, setShowActions] = useState(false)
  const [showDiscardModal, setShowDiscardModal] = useState(false)
  const [showClinicalUseModal, setShowClinicalUseModal] = useState(false)
  const [discardReason, setDiscardReason] = useState('')
  const [patientMRN, setPatientMRN] = useState('')
  const [clinicalNotes, setClinicalNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const actionsRef = useRef(null)

  const daysUntilExpiry = Math.floor(item.days_until_expiry)

  // Close actions menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (actionsRef.current && !actionsRef.current.contains(event.target)) {
        setShowActions(false)
      }
    }

    if (showActions) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [showActions])

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
    if (!patientMRN || patientMRN.trim() === '') {
      showError('MRN Required', 'Please enter the patient MRN')
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
          action: 'USE',
          version: item.version,
          patient_mrn: patientMRN,
          clinical_notes: clinicalNotes || null
        })
      })

      const data = await response.json()

      if (response.ok) {
        success('Stock Used', `${item.drug_name} marked as used for patient ${patientMRN}`)
        if (data.needs_notification) {
          console.log('Low stock alert triggered')
        }
        setShowClinicalUseModal(false)
        setPatientMRN('')
        setClinicalNotes('')
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

  const isAtLocation = item.location_id === user.location_id
  const [showLocationWarning, setShowLocationWarning] = useState(false)

  const handleActionClick = (e) => {
    e.stopPropagation()
    if (!isAtLocation) {
      setShowLocationWarning(true)
      return
    }
    setShowActions(!showActions)
  }

  if (compact) {
    return (
      <>
        <div className="relative" ref={actionsRef}>
          {!hideActions && (
            <button
              onClick={handleActionClick}
              disabled={loading}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors relative z-10"
            >
              <MoreVertical className="w-5 h-5 text-gray-500" />
            </button>
          )}

          {showActions && !loading && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-xl 
                            border border-gray-200 overflow-hidden z-50"
            >
              <button
                onClick={(e) => { e.stopPropagation(); setShowClinicalUseModal(true); setShowActions(false); }}
                className="w-full px-4 py-3 text-left hover:bg-emerald-50 transition-colors
                            flex items-center gap-3 text-emerald-700"
              >
                <CheckCircle className="w-4 h-4" />
                <span className="font-medium text-sm">Use (Clinical)</span>
              </button>

              <button
                onClick={(e) => { e.stopPropagation(); setShowDiscardModal(true); setShowActions(false); }}
                className="w-full px-4 py-3 text-left hover:bg-red-50 transition-colors
                            flex items-center gap-3 text-red-700 border-t"
              >
                <XCircle className="w-4 h-4" />
                <span className="font-medium text-sm">Discard</span>
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigate('/transfer', { state: { selectedItem: item } });
                  setShowActions(false);
                }}
                className="w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors
                            flex items-center gap-3 text-blue-700 border-t"
              >
                <TruckIcon className="w-4 h-4" />
                <span className="font-medium text-sm">Transfer</span>
              </button>
            </motion.div>
          )}
        </div>

        {/* Location Warning Modal */}
        {showLocationWarning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={(e) => { e.stopPropagation(); setShowLocationWarning(false); }}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border-l-4 border-amber-500"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-4 mb-4">
                <div className="p-3 bg-amber-100 rounded-full">
                  <MapPin className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Action Not Allowed</h3>
                  <p className="text-gray-600 mt-1">
                    This item is located at <span className="font-bold text-gray-900">{item.location_name}</span>.
                  </p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 mb-6 text-sm text-gray-700">
                <p className="mb-2">
                  You are currently logged in at <span className="font-semibold">{user.location_name}</span>.
                </p>
                <p>
                  To maintain inventory accuracy, you can only perform actions on items physically located at your current site.
                </p>
              </div>

              <button
                onClick={(e) => { e.stopPropagation(); setShowLocationWarning(false); }}
                className="w-full py-2.5 bg-gray-900 hover:bg-gray-800 text-white font-medium rounded-lg transition-colors"
              >
                Understood
              </button>
            </motion.div>
          </motion.div>
        )}

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

        {/* Clinical Use Modal - also for compact mode */}
        {showClinicalUseModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => { setShowClinicalUseModal(false); setPatientMRN(''); setClinicalNotes(''); }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
            >
              <h3 className="text-xl font-bold text-gray-900 mb-1">Clinical Use</h3>
              <p className="text-sm text-gray-600 mb-4">{item.drug_name} • {item.asset_id}</p>

              <div className="space-y-4">
                {/* Patient MRN - Required */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Patient MRN <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={patientMRN}
                    onChange={(e) => setPatientMRN(e.target.value)}
                    placeholder="Enter patient MRN"
                    className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:border-emerald-500 
                             focus:outline-none transition-colors text-sm"
                    autoFocus
                  />
                </div>

                {/* Clinical Notes - Optional */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Clinical Notes <span className="text-gray-400 font-normal">(Optional)</span>
                  </label>
                  <textarea
                    value={clinicalNotes}
                    onChange={(e) => setClinicalNotes(e.target.value)}
                    placeholder="Enter any relevant clinical notes..."
                    rows={3}
                    className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:border-emerald-500 
                             focus:outline-none transition-colors text-sm resize-none"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => { setShowClinicalUseModal(false); setPatientMRN(''); setClinicalNotes(''); }}
                  className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold 
                           rounded-lg transition-colors text-sm"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleUse}
                  disabled={loading || !patientMRN.trim()}
                  className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold 
                           rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {loading ? 'Processing...' : 'Confirm Use'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </>
    )
  }

  return (
    <>
      <motion.div
        whileHover={{ y: -2, scale: 1.02 }}
        className={`relative bg-white rounded-xl p-3 border-2 shadow-sm transition-all group
          ${showActions ? 'z-[100]' : 'z-0'}
          ${item.status_color === 'green' ? 'border-emerald-200 hover:border-emerald-300 hover:shadow-emerald-100' :
            item.status_color === 'amber' ? 'border-amber-200 hover:border-amber-300 hover:shadow-amber-100' :
              'border-red-200 hover:border-red-300 hover:shadow-red-100'}`}
      >
        {/* Glass effect background gradient */}
        <div className={`absolute inset-0 opacity-5 bg-gradient-to-br 
          ${item.status_color === 'green' ? 'from-emerald-100 to-emerald-50' :
            item.status_color === 'amber' ? 'from-amber-100 to-amber-50' :
              'from-red-100 to-red-50'}`}
        />

        {/* Content */}
        <div className="relative z-10">
          {/* Header with status badge */}
          <div className="flex items-start justify-between mb-2.5">
            <div className="flex-1 min-w-0 pr-2">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-gray-900 truncate">{item.drug_name}</h3>
                {item.quantity && item.quantity > 1 && (
                  <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded">
                    ×{item.quantity}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 truncate">{item.category}</p>
            </div>
            <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0
              ${item.status_color === 'green' ? 'bg-emerald-100 text-emerald-700' :
                item.status_color === 'amber' ? 'bg-amber-100 text-amber-700' :
                  'bg-red-100 text-red-700'}`}>
              {daysUntilExpiry > 0 ? `${daysUntilExpiry}d` : 'EXP'}
            </div>
          </div>

          {/* Compact Info Grid */}
          <div className="space-y-1.5 mb-2.5 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-gray-600">
                <QrCode className="w-3 h-3 flex-shrink-0" />
                <span className="font-mono font-semibold text-[11px]">{item.asset_id}</span>
              </div>
              <div className="flex items-center gap-1 text-gray-600">
                <storageIcon.icon className={`w-3 h-3 ${storageIcon.color} flex-shrink-0`} />
                <span className="text-[10px] font-medium">{storageIcon.label.split(' ')[0]}</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-gray-600">
                <MapPin className="w-3 h-3 flex-shrink-0" />
                <span className="truncate text-[11px]">{item.location_name}</span>
              </div>
              <div className="flex items-center gap-1 text-gray-600">
                <Hash className="w-3 h-3 flex-shrink-0" />
                <span className="font-mono text-[10px]">{item.batch_number}</span>
              </div>
            </div>
          </div>

          {/* Expiry - Simple display without progress bar */}
          <div className={`rounded-lg p-2 mb-2.5 border
            ${item.status_color === 'green' ? 'bg-emerald-50/50 border-emerald-100' :
              item.status_color === 'amber' ? 'bg-amber-50/50 border-amber-100' :
                'bg-red-50/50 border-red-100'}`}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-gray-600 font-medium">Expires</span>
              <span className="text-xs font-bold text-gray-900">
                {format(new Date(item.expiry_date), 'dd/MM/yy')}
              </span>
            </div>
          </div>

          {/* Price and Action in one row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-gray-500">Value:</span>
              <span className="text-sm font-bold gradient-text">
                ${item.unit_price?.toFixed(2)}
              </span>
            </div>

            <button
              onClick={handleActionClick}
              disabled={loading}
              className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium text-[11px]
                       rounded-md transition-all flex items-center gap-1
                       disabled:opacity-50 disabled:cursor-not-allowed relative z-10"
            >
              <MoreVertical className="w-3 h-3" />
              Actions
            </button>
          </div>

          {/* Action Menu */}
          {showActions && !loading && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-xl 
                       border border-gray-200 overflow-hidden z-[100]"
            >
              <button
                onClick={(e) => { e.stopPropagation(); setShowClinicalUseModal(true); setShowActions(false); }}
                className="w-full px-3 py-2 text-left hover:bg-emerald-50 transition-colors
                         flex items-center gap-2 text-emerald-700 text-sm"
              >
                <CheckCircle className="w-4 h-4" />
                <span className="font-medium">Use (Clinical)</span>
              </button>

              <button
                onClick={(e) => { e.stopPropagation(); setShowDiscardModal(true); setShowActions(false); }}
                className="w-full px-3 py-2 text-left hover:bg-red-50 transition-colors
                         flex items-center gap-2 text-red-700 border-t text-sm"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span className="font-medium">Discard</span>
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigate('/transfer', { state: { selectedItem: item } });
                  setShowActions(false);
                }}
                className="w-full px-3 py-2 text-left hover:bg-blue-50 transition-colors
                            flex items-center gap-2 text-blue-700 border-t text-sm"
              >
                <TruckIcon className="w-3.5 h-3.5" />
                <span className="font-medium">Transfer</span>
              </button>
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Location Warning Modal (for non-compact view) */}
      {showLocationWarning && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => { e.stopPropagation(); setShowLocationWarning(false); }}
        >
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border-l-4 border-amber-500"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-4 mb-4">
              <div className="p-3 bg-amber-100 rounded-full">
                <MapPin className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Action Not Allowed</h3>
                <p className="text-gray-600 mt-1">
                  This item is located at <span className="font-bold text-gray-900">{item.location_name}</span>.
                </p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 mb-6 text-sm text-gray-700">
              <p className="mb-2">
                You are currently logged in at <span className="font-semibold">{user.location_name}</span>.
              </p>
              <p>
                To maintain inventory accuracy, you can only perform actions on items physically located at your current site.
              </p>
            </div>

            <button
              onClick={(e) => { e.stopPropagation(); setShowLocationWarning(false); }}
              className="w-full py-2.5 bg-gray-900 hover:bg-gray-800 text-white font-medium rounded-lg transition-colors"
            >
              Understood
            </button>
          </motion.div>
        </motion.div>
      )}

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

      {/* Clinical Use Modal */}
      {showClinicalUseModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => { setShowClinicalUseModal(false); setPatientMRN(''); setClinicalNotes(''); }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
          >
            <h3 className="text-xl font-bold text-gray-900 mb-1">Clinical Use</h3>
            <p className="text-sm text-gray-600 mb-4">{item.drug_name} • {item.asset_id}</p>

            <div className="space-y-4">
              {/* Patient MRN - Required */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Patient MRN <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={patientMRN}
                  onChange={(e) => setPatientMRN(e.target.value)}
                  placeholder="Enter patient MRN"
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:border-emerald-500 
                           focus:outline-none transition-colors text-sm"
                  autoFocus
                />
              </div>

              {/* Clinical Notes - Optional */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Clinical Notes <span className="text-gray-400 font-normal">(Optional)</span>
                </label>
                <textarea
                  value={clinicalNotes}
                  onChange={(e) => setClinicalNotes(e.target.value)}
                  placeholder="Enter any relevant clinical notes..."
                  rows={3}
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:border-emerald-500 
                           focus:outline-none transition-colors text-sm resize-none"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowClinicalUseModal(false); setPatientMRN(''); setClinicalNotes(''); }}
                className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold 
                         rounded-lg transition-colors text-sm"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={handleUse}
                disabled={loading || !patientMRN.trim()}
                className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold 
                         rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {loading ? 'Processing...' : 'Confirm Use'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </>
  )
}

import { useState } from 'react'
import { X, Trash2, AlertCircle } from 'lucide-react'
import { stockAPI } from '../api/stock'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'

const DISCARD_REASONS = [
  { value: 'EXPIRED', label: 'Expired', description: 'Past expiry date' },
  { value: 'DAMAGED', label: 'Damaged', description: 'Physical damage to vial/packaging' },
  {
    value: 'CONTAMINATED',
    label: 'Contaminated',
    description: 'Suspected contamination'
  },
  { value: 'RECALLED', label: 'Recalled', description: 'Manufacturer recall' },
  { value: 'OTHER', label: 'Other', description: 'Other reason (specify in notes)' }
]

export default function StockDiscardModal({ vial, onClose, onSuccess }) {
  const user = useAuthStore((state) => state.user)
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [disposalNumber, setDisposalNumber] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Validate
    if (!reason) {
      toast.error('Please select a discard reason')
      return
    }

    if (reason === 'OTHER' && !notes) {
      toast.error('Please provide details in the notes field for "Other" reason')
      return
    }

    if (!disposalNumber) {
      toast.error('Please enter iPharmacy Disposal Number')
      return
    }

    setSubmitting(true)

    try {
      const response = await stockAPI.discardStock(
        vial.id,
        user.id,
        vial.version || 1,
        reason,
        disposalNumber
      )

      if (response.success) {
        toast.success('Stock discarded successfully')
        onSuccess?.()
        onClose()
      } else {
        if (response.error === 'CONFLICT') {
          toast.error(
            'This vial was modified by another user. Please refresh and try again.'
          )
        } else {
          toast.error(response.error || 'Failed to discard stock')
        }
      }
    } catch (error) {
      console.error('Stock discard error:', error)
      toast.error(error.response?.data?.error || 'Failed to discard stock')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 dark:bg-red-900/40 rounded-lg">
              <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Discard Stock
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6">
          {/* Vial Info */}
          <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="font-mono text-sm font-bold text-maroon dark:text-ochre mb-2">
              {vial.asset_id}
            </div>
            <div className="font-medium text-gray-900 dark:text-gray-100 mb-1">
              {vial.drug_name}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Batch: {vial.batch_number} • Expires:{' '}
              {new Date(vial.expiry_date).toLocaleDateString()}
            </div>
            <div className="mt-2">
              <span
                className={`badge ${
                  vial.status_color === 'green'
                    ? 'badge-green'
                    : vial.status_color === 'amber'
                    ? 'badge-amber'
                    : 'badge-red'
                }`}
              >
                {vial.days_until_expiry} days until expiry
              </span>
            </div>
          </div>

          {/* Discard Reason - REQUIRED */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-3">
              Discard Reason <span className="text-red-500">*</span>
            </label>
            <div className="space-y-2">
              {DISCARD_REASONS.map((option) => (
                <label
                  key={option.value}
                  className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    reason === option.value
                      ? 'border-maroon bg-maroon/5 dark:border-ochre dark:bg-ochre/5'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <input
                    type="radio"
                    name="reason"
                    value={option.value}
                    checked={reason === option.value}
                    onChange={(e) => setReason(e.target.value)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 dark:text-gray-100">
                      {option.label}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {option.description}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">
              Notes {reason === 'OTHER' && <span className="text-red-500">*</span>}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                reason === 'OTHER'
                  ? 'Please provide detailed explanation (required for "Other" reason)'
                  : 'Any additional details about the discard...'
              }
              rows={4}
              className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-maroon focus:border-transparent resize-none"
              required={reason === 'OTHER'}
              maxLength={500}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {notes.length}/500 characters
              {reason === 'OTHER' && ' (required)'}
            </p>
          </div>

          {/* iPharmacy Disposal Number */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">
              iPharmacy Disposal Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={disposalNumber}
              onChange={(e) => setDisposalNumber(e.target.value)}
              placeholder="e.g., DN2024-12345"
              className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-maroon focus:border-transparent"
              required
              maxLength={100}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Enter the disposal register number from iPharmacy
            </p>
          </div>

          {/* Warning */}
          <div className="mb-6 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-800 dark:text-red-200">
              <p className="font-medium mb-1">Warning</p>
              <p>
                This will mark the vial as DISCARDED and record wastage statistics.
                This action cannot be undone.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-danger flex-1 flex items-center justify-center gap-2"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Processing...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  Confirm Discard
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

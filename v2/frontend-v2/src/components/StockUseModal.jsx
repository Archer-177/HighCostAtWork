import { useState } from 'react'
import { X, Syringe, AlertCircle } from 'lucide-react'
import { stockAPI } from '../api/stock'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'

export default function StockUseModal({ vial, onClose, onSuccess }) {
  const user = useAuthStore((state) => state.user)
  const [patientMrn, setPatientMrn] = useState('')
  const [administeredAt, setAdministeredAt] = useState(
    new Date().toISOString().slice(0, 16)
  )
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Validate Patient MRN
    if (!patientMrn || patientMrn.length < 4) {
      toast.error('Patient MRN must be at least 4 characters')
      return
    }

    setSubmitting(true)

    try {
      const response = await stockAPI.useStock({
        vial_id: vial.id,
        version: vial.version || 1,
        user_id: user.id,
        patient_mrn: patientMrn,
        administered_at: administeredAt,
        notes: notes || undefined
      })

      if (response.success) {
        toast.success('Stock used successfully')
        onSuccess?.()
        onClose()
      } else {
        if (response.error === 'CONFLICT') {
          toast.error(
            'This vial was modified by another user. Please refresh and try again.'
          )
        } else {
          toast.error(response.error || 'Failed to use stock')
        }
      }
    } catch (error) {
      console.error('Stock use error:', error)
      toast.error(error.response?.data?.error || 'Failed to use stock')
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
            <div className="p-2 bg-green-100 dark:bg-green-900/40 rounded-lg">
              <Syringe className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Use Stock
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

          {/* Patient MRN - REQUIRED */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">
              Patient MRN <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={patientMrn}
              onChange={(e) => setPatientMrn(e.target.value)}
              placeholder="Enter patient medical record number"
              className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-maroon focus:border-transparent"
              required
              minLength={4}
              maxLength={20}
              autoFocus
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Required: 4-20 alphanumeric characters
            </p>
          </div>

          {/* Administration Date/Time */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">
              Administration Date & Time <span className="text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              value={administeredAt}
              onChange={(e) => setAdministeredAt(e.target.value)}
              max={new Date().toISOString().slice(0, 16)}
              className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-maroon focus:border-transparent"
              required
            />
          </div>

          {/* Notes (Optional) */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">
              Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes about this administration..."
              rows={3}
              className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-maroon focus:border-transparent resize-none"
              maxLength={500}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {notes.length}/500 characters
            </p>
          </div>

          {/* Warning */}
          <div className="mb-6 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800 dark:text-amber-200">
              <p className="font-medium mb-1">Important</p>
              <p>
                This will mark the vial as USED and record the patient MRN. This
                action cannot be undone.
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
              className="btn-primary flex-1 flex items-center justify-center gap-2"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Processing...
                </>
              ) : (
                <>
                  <Syringe className="w-4 h-4" />
                  Confirm Use
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

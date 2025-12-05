import { useState, useEffect } from 'react'
import { Plus, Trash2, Package, Calendar, Hash, DollarSign, X, CheckCircle } from 'lucide-react'
import { adminAPI } from '../api/admin'
import { stockAPI } from '../api/stock'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'

export default function StockReceive() {
  const user = useAuthStore((state) => state.user)
  const [drugs, setDrugs] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [receivedVials, setReceivedVials] = useState([])

  // Form state for adding vials
  const [vials, setVials] = useState([
    {
      drug_id: '',
      batch_number: '',
      expiry_date: '',
      quantity: 1,
      cost_per_unit: '',
      goods_receipt_number: ''
    }
  ])

  // Load drugs on mount
  useEffect(() => {
    loadDrugs()
  }, [])

  const loadDrugs = async () => {
    try {
      const data = await adminAPI.getDrugs()
      setDrugs(data)
    } catch (error) {
      toast.error('Failed to load drugs')
    } finally {
      setLoading(false)
    }
  }

  const addVialRow = () => {
    setVials([
      ...vials,
      {
        drug_id: '',
        batch_number: '',
        expiry_date: '',
        quantity: 1,
        cost_per_unit: '',
        goods_receipt_number: ''
      }
    ])
  }

  const removeVialRow = (index) => {
    if (vials.length === 1) {
      toast.error('Must have at least one vial entry')
      return
    }
    setVials(vials.filter((_, i) => i !== index))
  }

  const updateVial = (index, field, value) => {
    const updated = [...vials]
    updated[index][field] = value
    setVials(updated)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      // Validate all vials
      for (let i = 0; i < vials.length; i++) {
        const vial = vials[i]
        if (!vial.drug_id) {
          toast.error(`Row ${i + 1}: Please select a drug`)
          setSubmitting(false)
          return
        }
        if (!vial.batch_number) {
          toast.error(`Row ${i + 1}: Please enter batch number`)
          setSubmitting(false)
          return
        }
        if (!vial.expiry_date) {
          toast.error(`Row ${i + 1}: Please enter expiry date`)
          setSubmitting(false)
          return
        }
        if (vial.quantity < 1) {
          toast.error(`Row ${i + 1}: Quantity must be at least 1`)
          setSubmitting(false)
          return
        }

        // Check expiry date is in future
        const expiryDate = new Date(vial.expiry_date)
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        if (expiryDate <= today) {
          toast.error(`Row ${i + 1}: Expiry date must be in the future`)
          setSubmitting(false)
          return
        }
        if (!vial.goods_receipt_number) {
          toast.error(`Row ${i + 1}: Please enter iPharmacy Goods Receipt Number`)
          setSubmitting(false)
          return
        }
      }

      // Submit to backend
      const response = await stockAPI.receiveStock({
        user_id: user.id,
        location_id: user.location_id,
        vials: vials.map((v) => ({
          drug_id: parseInt(v.drug_id),
          batch_number: v.batch_number,
          expiry_date: v.expiry_date,
          quantity: parseInt(v.quantity),
          cost_per_unit: v.cost_per_unit ? parseFloat(v.cost_per_unit) : null,
          goods_receipt_number: v.goods_receipt_number
        }))
      })

      if (response.success) {
        setSuccess(true)
        setReceivedVials(response.vials || [])
        toast.success(
          `Successfully received ${response.total_count || vials.length} vial(s)`,
          { duration: 5000 }
        )

        // Reset form
        setVials([
          {
            drug_id: '',
            batch_number: '',
            expiry_date: '',
            quantity: 1,
            cost_per_unit: ''
          }
        ])
      } else {
        toast.error(response.error || 'Failed to receive stock')
      }
    } catch (error) {
      console.error('Stock receive error:', error)
      toast.error(error.response?.data?.error || 'Failed to receive stock')
    } finally {
      setSubmitting(false)
    }
  }

  const resetSuccess = () => {
    setSuccess(false)
    setReceivedVials([])
  }

  const getDrugName = (drugId) => {
    const drug = drugs.find((d) => d.id === parseInt(drugId))
    return drug ? drug.name : ''
  }

  const getTodayDate = () => {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-maroon"></div>
      </div>
    )
  }

  // Success screen
  if (success) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-4xl font-display font-bold gradient-text">Stock Received</h1>
          <button
            onClick={resetSuccess}
            className="btn-secondary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Receive More Stock
          </button>
        </div>

        <div className="card bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
          <div className="flex items-start gap-4 mb-6">
            <div className="p-3 bg-green-100 dark:bg-green-900/40 rounded-full">
              <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-green-900 dark:text-green-100 mb-2">
                Stock Successfully Received!
              </h2>
              <p className="text-green-700 dark:text-green-300">
                {receivedVials.length} vial(s) have been added to inventory at {user.location_name}
              </p>
            </div>
          </div>

          {/* Received Vials List */}
          <div className="space-y-3">
            <h3 className="font-semibold text-green-900 dark:text-green-100">
              Received Items:
            </h3>
            {receivedVials.map((vial, index) => (
              <div
                key={index}
                className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-green-200 dark:border-green-800"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-sm font-bold text-maroon dark:text-ochre">
                    {vial.asset_id}
                  </span>
                  {vial.has_label && (
                    <button className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400">
                      Print Label
                    </button>
                  )}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  <div className="font-medium text-gray-900 dark:text-gray-100 mb-1">
                    {vial.drug_name}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    <span>Batch: {vial.batch_number}</span>
                    <span>Expires: {new Date(vial.expiry_date).toLocaleDateString()}</span>
                    <span>Qty: {vial.quantity}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Main form
  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-4xl font-display font-bold gradient-text mb-2">
          Receive Stock
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Add new stock items received from suppliers to {user.location_name}
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="card mb-6">
          {/* Header Row */}
          <div className="grid grid-cols-12 gap-4 mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300 pb-3 border-b border-gray-200 dark:border-gray-700">
            <div className="col-span-3">Drug</div>
            <div className="col-span-2">Batch Number</div>
            <div className="col-span-2">Expiry Date</div>
            <div className="col-span-2">Quantity</div>
            <div className="col-span-2">Cost/Unit ($)</div>
            <div className="col-span-1"></div>
          </div>

          {/* Vial Rows */}
          <div className="space-y-4">
            {vials.map((vial, index) => (
              <div
                key={index}
                className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
              >
                <div className="grid grid-cols-12 gap-4 items-start mb-3">
                  {/* Drug Selection */}
                  <div className="col-span-3">
                    <select
                      value={vial.drug_id}
                      onChange={(e) => updateVial(index, 'drug_id', e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-maroon focus:border-transparent"
                      required
                    >
                      <option value="">Select drug...</option>
                      {drugs.map((drug) => (
                        <option key={drug.id} value={drug.id}>
                          {drug.name} ({drug.category})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Batch Number */}
                  <div className="col-span-2">
                    <input
                      type="text"
                      value={vial.batch_number}
                      onChange={(e) => updateVial(index, 'batch_number', e.target.value)}
                      placeholder="e.g., BT2024001"
                      className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-maroon focus:border-transparent"
                      required
                    />
                  </div>

                  {/* Expiry Date */}
                  <div className="col-span-2">
                    <input
                      type="date"
                      value={vial.expiry_date}
                      onChange={(e) => updateVial(index, 'expiry_date', e.target.value)}
                      min={getTodayDate()}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-maroon focus:border-transparent"
                      required
                    />
                  </div>

                  {/* Quantity */}
                  <div className="col-span-2">
                    <input
                      type="number"
                      value={vial.quantity}
                      onChange={(e) => updateVial(index, 'quantity', e.target.value)}
                      min="1"
                      max="1000"
                      className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-maroon focus:border-transparent"
                      required
                    />
                  </div>

                  {/* Cost per Unit */}
                  <div className="col-span-2">
                    <input
                      type="number"
                      value={vial.cost_per_unit}
                      onChange={(e) => updateVial(index, 'cost_per_unit', e.target.value)}
                      step="0.01"
                      min="0"
                      placeholder="Optional"
                      className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-maroon focus:border-transparent"
                    />
                  </div>

                  {/* Remove Button */}
                  <div className="col-span-1 flex items-center justify-center">
                    <button
                      type="button"
                      onClick={() => removeVialRow(index)}
                      className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title="Remove row"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* iPharmacy Goods Receipt Number - Full Width Below */}
                <div className="grid grid-cols-12 gap-4">
                  <div className="col-span-11">
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      iPharmacy Goods Receipt Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={vial.goods_receipt_number}
                      onChange={(e) => updateVial(index, 'goods_receipt_number', e.target.value)}
                      placeholder="e.g., GR2024-12345"
                      className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-maroon focus:border-transparent"
                      required
                    />
                  </div>
                  <div className="col-span-1"></div>
                </div>
              </div>
            ))}
          </div>

          {/* Add Row Button */}
          <button
            type="button"
            onClick={addVialRow}
            className="mt-4 w-full py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:border-maroon hover:text-maroon dark:hover:border-ochre dark:hover:text-ochre transition-colors flex items-center justify-center gap-2 font-medium"
          >
            <Plus className="w-5 h-5" />
            Add Another Item
          </button>
        </div>

        {/* Summary Card */}
        <div className="card bg-gradient-to-br from-maroon/5 to-ochre/5 dark:from-maroon/10 dark:to-ochre/10 mb-6">
          <h3 className="text-lg font-semibold mb-3">Summary</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-white dark:bg-gray-800 rounded-lg">
              <div className="text-3xl font-bold text-maroon dark:text-ochre mb-1">
                {vials.length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Unique Items
              </div>
            </div>
            <div className="text-center p-4 bg-white dark:bg-gray-800 rounded-lg">
              <div className="text-3xl font-bold text-maroon dark:text-ochre mb-1">
                {vials.reduce((sum, v) => sum + (parseInt(v.quantity) || 0), 0)}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Total Vials
              </div>
            </div>
            <div className="text-center p-4 bg-white dark:bg-gray-800 rounded-lg">
              <div className="text-3xl font-bold text-maroon dark:text-ochre mb-1">
                ${vials
                  .reduce(
                    (sum, v) =>
                      sum +
                      (parseFloat(v.cost_per_unit) || 0) * (parseInt(v.quantity) || 0),
                    0
                  )
                  .toFixed(2)}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Total Value
              </div>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex gap-4">
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary flex-1 flex items-center justify-center gap-2 py-4 text-lg"
          >
            {submitting ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Processing...
              </>
            ) : (
              <>
                <Package className="w-5 h-5" />
                Receive Stock
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

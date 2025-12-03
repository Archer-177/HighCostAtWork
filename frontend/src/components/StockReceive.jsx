import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Package, Calendar, Hash, Plus, Printer, Save,
  AlertCircle, CheckCircle, ChevronDown, Pill
} from 'lucide-react'
import { format } from 'date-fns'
import { useAuth } from '../contexts/AuthContext'
import { useNotification } from '../contexts/NotificationContext'
import QRCode from 'react-qr-code'

export default function StockReceive() {
  const { user } = useAuth()
  const { success, error: showError } = useNotification()

  const [drugs, setDrugs] = useState([])
  const [selectedDrug, setSelectedDrug] = useState('')
  const [batchNumber, setBatchNumber] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [goodsReceiptNumber, setGoodsReceiptNumber] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [loading, setLoading] = useState(false)
  const [showLabels, setShowLabels] = useState(false)
  const [generatedAssets, setGeneratedAssets] = useState([])

  useEffect(() => {
    fetchDrugs()
  }, [])

  const fetchDrugs = async () => {
    try {
      const response = await fetch('/api/drugs')
      const data = await response.json()
      if (response.ok) {
        setDrugs(data)
      }
    } catch (err) {
      showError('Failed to load drugs', 'Could not fetch drug catalog')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!selectedDrug || !batchNumber || !expiryDate || quantity < 1 || !goodsReceiptNumber) {
      showError('Validation Error', 'Please fill all required fields')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/receive_stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          drug_id: parseInt(selectedDrug),
          batch_number: batchNumber,
          expiry_date: expiryDate,
          quantity: parseInt(quantity),
          location_id: user.location_id,
          user_id: user.id,
          goods_receipt_number: goodsReceiptNumber
        })
      })

      const data = await response.json()

      if (response.ok) {
        success(
          'Stock Received Successfully',
          `${quantity} units of ${data.drug_name} added (Value: $${data.total_value.toFixed(2)})`
        )
        setGeneratedAssets(data.asset_ids)
        setShowLabels(true)

        // Reset form
        setSelectedDrug('')
        setBatchNumber('')
        setExpiryDate('')
        setGoodsReceiptNumber('')
        setQuantity(1)
      } else {
        showError('Failed to receive stock', data.error)
      }
    } catch (err) {
      showError('Connection Error', 'Failed to save stock')
    } finally {
      setLoading(false)
    }
  }

  const printLabels = async () => {
    if (generatedAssets.length === 0) return

    const payload = {
      asset_ids: generatedAssets,
      location_id: user?.location_id
    }

    try {
      const response = await fetch('/api/generate_labels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (response.ok) {
        success('Labels Sent', 'Labels sent to Zebra printer')
        setShowLabels(false)
        setGeneratedAssets([])
      } else {
        const data = await response.json()
        showError('Print Error', data.error || 'Failed to send labels to printer')
      }
    } catch (err) {
      showError('Connection Error', 'Could not connect to printer service')
    }
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
          Receive Stock
        </h1>
        <p className="text-gray-600">
          Process incoming medicine deliveries from suppliers
        </p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-maroon-500 to-maroon-700 rounded-xl 
                            flex items-center justify-center">
                <Package className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">New Stock Entry</h2>
                <p className="text-sm text-gray-600">Location: {user.location_name}</p>
              </div>
            </div>

            <div className="space-y-6">
              {/* Drug Selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Select Medicine *
                </label>
                <div className="relative">
                  <select
                    value={selectedDrug}
                    onChange={(e) => setSelectedDrug(e.target.value)}
                    className="w-full pl-12 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl
                             appearance-none focus:outline-none focus:border-maroon-500 focus:bg-white 
                             transition-all cursor-pointer"
                    required
                  >
                    <option value="">Choose a medicine...</option>
                    {drugs.map(drug => (
                      <option key={drug.id} value={drug.id}>
                        {drug.name} - ${drug.unit_price} ({drug.storage_temp})
                      </option>
                    ))}
                  </select>
                  <Pill className="absolute left-4 top-3.5 w-5 h-5 text-gray-400 pointer-events-none" />
                  <ChevronDown className="absolute right-4 top-3.5 w-5 h-5 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Goods Receipt Number */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  iPharmacy Goods Receipt Number *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={goodsReceiptNumber}
                    onChange={(e) => setGoodsReceiptNumber(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl
                             focus:outline-none focus:border-maroon-500 focus:bg-white transition-all"
                    placeholder="e.g., GRN-123456"
                    required
                  />
                  <Hash className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
                </div>
              </div>

              {/* Batch Number */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Batch Number *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={batchNumber}
                    onChange={(e) => setBatchNumber(e.target.value.toUpperCase())}
                    className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl
                             focus:outline-none focus:border-maroon-500 focus:bg-white transition-all"
                    placeholder="e.g., BATCH-2024-001"
                    required
                  />
                  <Hash className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
                </div>
              </div>

              {/* Expiry Date */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Expiry Date *
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    min={format(new Date(), 'yyyy-MM-dd')}
                    className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl
                             focus:outline-none focus:border-maroon-500 focus:bg-white transition-all"
                    required
                  />
                  <Calendar className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
                </div>
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Quantity (Boxes/Vials) *
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-gray-100 
                             hover:bg-gray-200 rounded-lg flex items-center justify-center transition-colors"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-16 py-3 bg-gray-50 border border-gray-200 rounded-xl
                             text-center font-semibold text-lg focus:outline-none focus:border-maroon-500 
                             focus:bg-white transition-all"
                    min="1"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setQuantity(quantity + 1)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-gray-100 
                             hover:bg-gray-200 rounded-lg flex items-center justify-center transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || !selectedDrug || !batchNumber || !expiryDate || !goodsReceiptNumber}
                className="w-full py-3 bg-gradient-to-r from-maroon-600 to-maroon-800 text-white 
                         font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 
                         transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
                         flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="spinner w-5 h-5" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Receive Stock
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Info Box */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-6 p-6 bg-blue-50 border border-blue-200 rounded-xl"
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-blue-900 mb-2">Important Notes:</p>
                <ul className="space-y-1 text-blue-800">
                  <li>• Each box/vial will receive a unique Asset ID</li>
                  <li>• QR code labels will be generated automatically</li>
                  <li>• Ensure batch number matches supplier documentation</li>
                  <li>• Stock value will be calculated based on catalog prices</li>
                </ul>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* Labels Preview */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          {showLabels && generatedAssets.length > 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-900">Generated Labels</h3>
                <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium">
                  {generatedAssets.length} labels ready
                </span>
              </div>

              {/* Label Preview Grid */}
              <div className="grid grid-cols-2 gap-4 mb-6 max-h-96 overflow-y-auto custom-scrollbar">
                {generatedAssets.map((assetId, index) => (
                  <motion.div
                    key={assetId}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.05 }}
                    className="label-print border-2 border-dashed border-gray-300 rounded-lg p-4 
                             bg-gray-50 flex flex-col items-center justify-center"
                  >
                    <div className="w-20 h-20 bg-white rounded mb-2 flex items-center justify-center">
                      <QRCode
                        value={assetId}
                        size={80}
                        level="M"
                        viewBox={`0 0 256 256`}
                      />
                    </div>
                    <p className="font-mono font-bold text-sm">{assetId}</p>
                  </motion.div>
                ))}
              </div>

              {/* Print Button */}
              <button
                onClick={printLabels}
                className="w-full py-3 bg-gradient-to-r from-gray-700 to-gray-900 text-white 
                         font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 
                         transition-all flex items-center justify-center gap-2"
              >
                <Printer className="w-5 h-5" />
                Send to Zebra Printer
              </button>

              <p className="text-xs text-gray-500 mt-4 text-center">
                Labels will be printed on 2" x 1" thermal labels optimised for medicine tracking
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 
                          flex flex-col items-center justify-center h-full text-gray-400">
              <Printer className="w-16 h-16 mb-4" />
              <p className="text-lg font-medium">No labels generated yet</p>
              <p className="text-sm mt-2">Labels will appear here after receiving stock</p>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}

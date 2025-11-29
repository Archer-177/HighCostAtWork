import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Package, Save, X, AlertCircle, CheckCircle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useNotification } from '../contexts/NotificationContext'

export default function StockLevelsSettings() {
    const { user } = useAuth()
    const { success, error: showError } = useNotification()
    const [stockLevels, setStockLevels] = useState([])
    const [locations, setLocations] = useState([])
    const [drugs, setDrugs] = useState([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [editedLevels, setEditedLevels] = useState({})

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        try {
            const [locationsRes, drugsRes, levelsRes] = await Promise.all([
                fetch('/api/locations'),
                fetch('/api/drugs'),
                fetch('/api/stock_levels')
            ])

            const locationsData = await locationsRes.json()
            const drugsData = await drugsRes.json()
            const levelsData = await levelsRes.json()

            setLocations(locationsData)
            setDrugs(drugsData)
            setStockLevels(levelsData)
        } catch (err) {
            showError('Load Error', 'Failed to load stock levels')
        } finally {
            setLoading(false)
        }
    }

    const handleMinStockChange = (locationId, drugId, value) => {
        const key = `${locationId}-${drugId}`
        setEditedLevels(prev => ({
            ...prev,
            [key]: parseInt(value) || 0
        }))
    }

    const getMinStock = (locationId, drugId) => {
        const key = `${locationId}-${drugId}`
        if (editedLevels[key] !== undefined) {
            return editedLevels[key]
        }
        const level = stockLevels.find(l => l.location_id === locationId && l.drug_id === drugId)
        return level?.min_stock || 0
    }

    const hasChanges = Object.keys(editedLevels).length > 0

    const handleSave = async () => {
        setSaving(true)
        try {
            const updates = Object.entries(editedLevels).map(([key, minStock]) => {
                const [locationId, drugId] = key.split('-').map(Number)
                return { location_id: locationId, drug_id: drugId, min_stock: minStock }
            })

            const response = await fetch('/api/stock_levels', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ updates })
            })

            if (response.ok) {
                success('Saved', 'Stock levels updated successfully')
                setEditedLevels({})
                fetchData()
            } else {
                showError('Error', 'Failed to update stock levels')
            }
        } catch (err) {
            showError('Connection Error', 'Failed to save changes')
        } finally {
            setSaving(false)
        }
    }

    const handleCancel = () => {
        setEditedLevels({})
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-maroon-600" />
            </div>
        )
    }

    // Only allow pharmacists
    if (user.role !== 'PHARMACIST') {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-gray-900">Access Denied</h2>
                    <p className="text-gray-600">Only pharmacists can access stock level settings</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-sand via-white to-orange-50 p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                        <Package className="w-8 h-8 text-maroon-600" />
                        Minimum Stock Levels
                    </h1>
                    <p className="text-gray-600 mt-2">
                        Set minimum stock thresholds for automatic low stock alerts
                    </p>
                </div>

                {/* Actions Bar */}
                {hasChanges && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-4 bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between"
                    >
                        <div className="flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 text-blue-600" />
                            <span className="font-semibold text-blue-900">
                                You have unsaved changes
                            </span>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={handleCancel}
                                disabled={saving}
                                className="px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 font-medium rounded-lg 
                         transition-colors border border-gray-200 flex items-center gap-2"
                            >
                                <X className="w-4 h-4" />
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg 
                         transition-colors flex items-center gap-2 disabled:opacity-50"
                            >
                                <Save className="w-4 h-4" />
                                {saving ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </motion.div>
                )}

                {/* Stock Levels Table */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200">
                                <tr>
                                    <th className="px-6 py-4 text-left font-bold text-gray-800 sticky left-0 bg-gray-50">
                                        Location
                                    </th>
                                    {drugs.map(drug => (
                                        <th key={drug.id} className="px-6 py-4 text-center font-bold text-gray-800 min-w-[150px]">
                                            <div className="flex flex-col">
                                                <span>{drug.name}</span>
                                                <span className="text-xs font-normal text-gray-500">{drug.category}</span>
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {locations.map((location, index) => (
                                    <tr key={location.id} className={`hover:bg-blue-50 transition-colors
                    ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                                        <td className="px-6 py-4 font-semibold text-gray-900 sticky left-0 bg-inherit">
                                            <div>
                                                {location.name}
                                                <div className="text-xs font-normal text-gray-500">{location.type}</div>
                                            </div>
                                        </td>
                                        {drugs.map(drug => {
                                            const currentValue = getMinStock(location.id, drug.id)
                                            const isEdited = editedLevels[`${location.id}-${drug.id}`] !== undefined

                                            return (
                                                <td key={drug.id} className="px-6 py-4">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={currentValue}
                                                        onChange={(e) => handleMinStockChange(location.id, drug.id, e.target.value)}
                                                        className={`w-24 px-3 py-2 text-center border-2 rounded-lg transition-colors
                              ${isEdited
                                                                ? 'border-blue-500 bg-blue-50'
                                                                : 'border-gray-200 focus:border-maroon-500'
                                                            } focus:outline-none`}
                                                    />
                                                </td>
                                            )
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Help Text */}
                <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <div className="flex gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-amber-900">
                            <p className="font-semibold mb-1">About Minimum Stock Levels</p>
                            <p>
                                These thresholds trigger low stock notifications. When available stock falls below the minimum level,
                                pharmacists will receive alerts to reorder or transfer stock. Changes are saved automatically to the database.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

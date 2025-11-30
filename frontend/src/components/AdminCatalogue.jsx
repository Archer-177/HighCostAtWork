import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Save, X } from 'lucide-react'
import { useNotification } from '../contexts/NotificationContext'

export default function AdminCatalogue() {
    const { success, error: showError } = useNotification()
    const [isAdding, setIsAdding] = useState(false)
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        name: '',
        category: '',
        storage_temp: '<25°C',
        unit_price: ''
    })

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)
        try {
            const response = await fetch('/api/drugs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    unit_price: parseFloat(formData.unit_price)
                })
            })

            if (response.ok) {
                success('Drug Added', `${formData.name} has been added to the catalogue`)
                setIsAdding(false)
                setFormData({ name: '', category: '', storage_temp: '<25°C', unit_price: '' })
            } else {
                showError('Failed to add drug')
            }
        } catch (err) {
            showError('Connection Error')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Drug Catalogue</h2>
                <button
                    onClick={() => setIsAdding(!isAdding)}
                    className="flex items-center gap-2 px-4 py-2 bg-maroon-600 text-white rounded-lg hover:bg-maroon-700 transition-colors"
                >
                    {isAdding ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    {isAdding ? 'Cancel' : 'Add New Drug'}
                </button>
            </div>

            {isAdding && (
                <motion.form
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    onSubmit={handleSubmit}
                    className="bg-gray-50 p-6 rounded-xl mb-6 space-y-4"
                >
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Drug Name</label>
                            <input
                                required
                                type="text"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-maroon-500"
                                placeholder="e.g. Tenecteplase"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                            <input
                                required
                                type="text"
                                value={formData.category}
                                onChange={e => setFormData({ ...formData, category: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-maroon-500"
                                placeholder="e.g. Thrombolytic"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Storage Temp</label>
                            <select
                                value={formData.storage_temp}
                                onChange={e => setFormData({ ...formData, storage_temp: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-maroon-500"
                            >
                                <option value="<25°C">Shelf (&lt;25°C)</option>
                                <option value="2-8°C">Fridge (2-8°C)</option>
                                <option value="<8°C">Cold Chain (&lt;8°C)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Unit Price (AUD)</label>
                            <input
                                required
                                type="number"
                                step="0.01"
                                value={formData.unit_price}
                                onChange={e => setFormData({ ...formData, unit_price: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-maroon-500"
                                placeholder="0.00"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                        >
                            {loading ? 'Saving...' : <><Save className="w-4 h-4" /> Save Drug</>}
                        </button>
                    </div>
                </motion.form>
            )}

            <div className="text-center text-gray-500 py-8 bg-gray-50 rounded-xl border-2 border-dashed">
                Catalogue list view would go here...
            </div>
        </div>
    )
}

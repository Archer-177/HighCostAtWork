import React from 'react';
import { motion } from 'framer-motion';
import { Plus, Edit2, Trash2, Thermometer } from 'lucide-react';
import { useNotification } from '../../contexts/NotificationContext';

export default function DrugsCatalogue({ drugs, onAdd, onEdit, onDelete, currentUser }) {
  const { success, error: showError } = useNotification();

  // Only allow editing/adding drugs if the user is a pharmacist
  const canManageDrugs = currentUser?.role === 'PHARMACIST';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
      <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <h2 className="text-xl font-bold dark:text-white">Medicine Catalogue</h2>
        {canManageDrugs && (
          <button
            onClick={onAdd}
            className="px-4 py-2 bg-maroon-600 hover:bg-maroon-700 text-white 
                   font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Medicine
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-3 px-6 font-semibold text-gray-700 dark:text-gray-300">Name</th>
              <th className="text-left py-3 px-6 font-semibold text-gray-700 dark:text-gray-300">Category</th>
              <th className="text-left py-3 px-6 font-semibold text-gray-700 dark:text-gray-300">Storage</th>
              <th className="text-right py-3 px-6 font-semibold text-gray-700 dark:text-gray-300">Unit Price</th>
              <th className="text-right py-3 px-6 font-semibold text-gray-700 dark:text-gray-300">Actions</th>
            </tr>
          </thead>
          <tbody>
            {drugs.map(drug => (
              <tr key={drug.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="py-3 px-6 font-medium dark:text-white">{drug.name}</td>
                <td className="py-3 px-6 dark:text-gray-300">{drug.category}</td>
                <td className="py-3 px-6">
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${drug.storage_temp?.includes('2-8')
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
                    }`}>
                    <Thermometer className="w-3 h-3" />
                    {drug.storage_temp}
                  </span>
                </td>
                <td className="text-right py-3 px-6 font-mono dark:text-gray-300">
                  ${drug.unit_price.toFixed(2)}
                </td>
                <td className="text-right py-3 px-6">
                  {canManageDrugs ? (
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => onEdit(drug)}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                      </button>
                      <button
                        onClick={() => onDelete(drug)}
                        className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400 italic py-2">Read Only</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

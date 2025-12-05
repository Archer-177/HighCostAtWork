import React from 'react';
import { motion } from 'framer-motion';
import { Building2, MapPin, Heart, Edit2, Trash2, Plus } from 'lucide-react';
import { useNotification } from '../../contexts/NotificationContext';

export default function LocationsManagement({ locations, onAdd, onEdit, onDelete, currentUser }) {
  const { success, error: showError } = useNotification()

  const locationIcon = {
    'HUB': Building2,
    'WARD': Heart,
    'REMOTE': MapPin
  }

  // Only allow managing locations if the user is a pharmacist OR a supervisor
  const canManageLocations = currentUser?.role === 'PHARMACIST' || currentUser?.is_supervisor;

  const handleSetMinStock = async (locationId, drugId, minStock) => {
    try {
      const response = await fetch('/api/stock_levels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location_id: locationId, drug_id: drugId, min_stock: minStock })
      })

      if (response.ok) {
        success('Min Stock Updated', 'Minimum stock level has been set')
      }
    } catch (err) {
      showError('Failed to update stock level')
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
      <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <h2 className="text-xl font-bold dark:text-white">Locations</h2>
        {canManageLocations && (
          <button
            onClick={onAdd}
            className="px-4 py-2 bg-maroon-600 hover:bg-maroon-700 text-white 
                   font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Location
          </button>
        )}
      </div>

      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        {locations.map(location => {
          const Icon = locationIcon[location.type]
          // 1. No one can edit HUBs (except maybe the Hub supervisor?) -> Let's allow Hub supervisor to edit their hub.
          // 2. Supervisors can only edit their own hub hierarchy
          const isHub = location.type === 'HUB'

          // Logic:
          // - Must have permission (Pharmacist or Supervisor)
          // - If Supervisor: Must be THEIR location OR a child of THEIR location
          // - If Pharmacist (non-supervisor): Can edit everything (unless restricted by other rules, but let's assume Pharmacists are admins)

          const isMyHierarchy = currentUser?.is_supervisor && (
            location.id === currentUser.location_id ||
            location.parent_hub_id === currentUser.location_id
          );

          const canEditLocation = canManageLocations && (
            !currentUser?.is_supervisor || isMyHierarchy
          );

          return (
            <motion.div
              key={location.id}
              whileHover={{ scale: 1.02 }}
              className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:shadow-md transition-all bg-white dark:bg-gray-800"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${location.type === 'HUB' ? 'bg-maroon-100 dark:bg-maroon-900/40' :
                    location.type === 'WARD' ? 'bg-ochre-100 dark:bg-amber-900/40' : 'bg-blue-100 dark:bg-blue-900/40'
                    }`}>
                    <Icon className={`w-5 h-5 ${location.type === 'HUB' ? 'text-maroon-600 dark:text-maroon-400' :
                      location.type === 'WARD' ? 'text-ochre-600 dark:text-amber-400' : 'text-blue-600 dark:text-blue-400'
                      }`} />
                  </div>
                  <div>
                    <h3 className="font-semibold dark:text-white">{location.name}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{location.type}</p>
                  </div>
                </div>

                {canEditLocation ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => onEdit(location)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      title="Edit Location"
                    >
                      <Edit2 className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    </button>
                    <button
                      onClick={() => onDelete(location)}
                      className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title="Delete Location"
                    >
                      <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                    </button>
                  </div>
                ) : (
                  <span className="text-xs text-gray-400 italic py-2">Read Only</span>
                )}
              </div>

              {location.parent_hub_id && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Parent Hub: {locations.find(l => l.id === location.parent_hub_id)?.name}
                </p>
              )}
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
